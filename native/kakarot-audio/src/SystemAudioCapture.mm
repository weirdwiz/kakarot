#import "SystemAudioCapture.h"
#import <CoreMedia/CoreMedia.h>
#import <AVFoundation/AVFoundation.h>
#import <mach/mach_time.h>
#include <vector>

@interface SystemAudioCapture () {
    SCStream *_stream;
    SCStreamConfiguration *_configuration;
    SCContentFilter *_filter;
    Float64 _sampleRate;
    SystemAudioDataCallback _callback;
    BOOL _isCapturing;
    dispatch_queue_t _captureQueue;

    // For CMTime to mach_absolute_time conversion
    double _timebaseNanos;
}
@end

@implementation SystemAudioCapture

- (instancetype)initWithSampleRate:(Float64)sampleRate
                          callback:(SystemAudioDataCallback)callback {
    self = [super init];
    if (self) {
        _sampleRate = sampleRate;
        _callback = [callback copy];
        _isCapturing = NO;
        _captureQueue = dispatch_queue_create("com.kakarot.system-audio-capture",
                                              DISPATCH_QUEUE_SERIAL);

        // Get mach timebase for CMTime conversion
        mach_timebase_info_data_t info;
        mach_timebase_info(&info);
        _timebaseNanos = (double)info.numer / (double)info.denom;
    }
    return self;
}

- (void)dealloc {
    [self stop];
}

- (BOOL)start:(NSError **)error {
    if (_isCapturing) {
        return YES;
    }

    // Get shareable content
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block SCShareableContent *content = nil;
    __block NSError *contentError = nil;

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent * _Nullable shareableContent,
                                                                    NSError * _Nullable err) {
        content = shareableContent;
        contentError = err;
        dispatch_semaphore_signal(semaphore);
    }];

    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);

    if (contentError) {
        if (error) {
            *error = contentError;
        }
        return NO;
    }

    if (!content || content.displays.count == 0) {
        if (error) {
            *error = [NSError errorWithDomain:@"SystemAudioCapture"
                                         code:-1
                                     userInfo:@{NSLocalizedDescriptionKey: @"No displays available"}];
        }
        return NO;
    }

    // Create content filter for audio-only capture
    // Use display filter but we only capture audio
    SCDisplay *display = content.displays.firstObject;

    // Exclude all windows to get system audio only
    _filter = [[SCContentFilter alloc] initWithDisplay:display
                                      excludingWindows:@[]];

    // Configure stream for audio-only
    _configuration = [[SCStreamConfiguration alloc] init];

    // Disable video capture
    _configuration.width = 2;  // Minimum
    _configuration.height = 2;
    _configuration.minimumFrameInterval = CMTimeMake(1, 1); // 1 FPS minimum
    _configuration.capturesAudio = YES;
    _configuration.excludesCurrentProcessAudio = YES; // Don't capture our own audio
    _configuration.sampleRate = (int)_sampleRate;
    _configuration.channelCount = 1; // Mono

    // Create stream
    _stream = [[SCStream alloc] initWithFilter:_filter
                                 configuration:_configuration
                                      delegate:self];

    // Add stream output for audio
    NSError *addOutputError = nil;
    BOOL added = [_stream addStreamOutput:self
                                     type:SCStreamOutputTypeAudio
                       sampleHandlerQueue:_captureQueue
                                    error:&addOutputError];
    if (!added) {
        if (error) {
            *error = addOutputError ?: [NSError errorWithDomain:@"SystemAudioCapture"
                                                           code:-1
                                                       userInfo:@{NSLocalizedDescriptionKey: @"Failed to add stream output"}];
        }
        return NO;
    }

    // Start stream
    __block NSError *startError = nil;
    dispatch_semaphore_t startSemaphore = dispatch_semaphore_create(0);

    [_stream startCaptureWithCompletionHandler:^(NSError * _Nullable err) {
        startError = err;
        dispatch_semaphore_signal(startSemaphore);
    }];

    // Wait with timeout to avoid blocking forever
    dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC);
    long result = dispatch_semaphore_wait(startSemaphore, timeout);
    if (result != 0) {
        NSLog(@"SystemAudioCapture: Timeout waiting for stream start");
        if (error) {
            *error = [NSError errorWithDomain:@"SystemAudioCapture"
                                         code:-1
                                     userInfo:@{NSLocalizedDescriptionKey: @"Timeout starting stream"}];
        }
        return NO;
    }

    if (startError) {
        if (error) {
            *error = startError;
        }
        return NO;
    }

    _isCapturing = YES;
    return YES;
}

- (void)stop {
    if (!_isCapturing) {
        return;
    }

    _isCapturing = NO;

    if (_stream) {
        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        [_stream stopCaptureWithCompletionHandler:^(NSError * _Nullable error) {
            dispatch_semaphore_signal(semaphore);
        }];
        dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC));
        _stream = nil;
    }

    _filter = nil;
    _configuration = nil;
}

#pragma mark - SCStreamDelegate

- (void)stream:(SCStream *)stream didStopWithError:(NSError *)error {
    NSLog(@"SystemAudioCapture: stream stopped with error: %@", error);
    _isCapturing = NO;
}

#pragma mark - SCStreamOutput

- (void)stream:(SCStream *)stream
didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer
        ofType:(SCStreamOutputType)type {
    if (type != SCStreamOutputTypeAudio) {
        return;
    }

    if (!_isCapturing || !_callback) {
        return;
    }

    // Get timestamp
    CMTime presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer);
    uint64_t hostTime = [self cmTimeToHostTime:presentationTime];

    // Get audio buffer
    CMBlockBufferRef blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer);
    if (!blockBuffer) {
        return;
    }

    size_t totalLength = 0;
    char *dataPointer = NULL;
    OSStatus status = CMBlockBufferGetDataPointer(blockBuffer,
                                                   0,
                                                   NULL,
                                                   &totalLength,
                                                   &dataPointer);
    if (status != kCMBlockBufferNoErr || !dataPointer) {
        return;
    }

    // Get format description to determine sample format
    CMFormatDescriptionRef formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer);
    const AudioStreamBasicDescription *asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc);

    if (!asbd) {
        return;
    }

    // Convert to int16 if needed (ScreenCaptureKit may provide float32)
    if (asbd->mFormatFlags & kAudioFormatFlagIsFloat) {
        // Float32 to Int16 conversion
        size_t sampleCount = totalLength / sizeof(float);
        std::vector<int16_t> int16Samples(sampleCount);

        const float *floatSamples = (const float *)dataPointer;
        for (size_t i = 0; i < sampleCount; i++) {
            float sample = floatSamples[i];
            // Clamp and convert
            if (sample > 1.0f) sample = 1.0f;
            if (sample < -1.0f) sample = -1.0f;
            int16Samples[i] = (int16_t)(sample * 32767.0f);
        }

        _callback(int16Samples.data(), sampleCount, hostTime);
    } else {
        // Already int16
        size_t sampleCount = totalLength / sizeof(int16_t);
        const int16_t *samples = (const int16_t *)dataPointer;
        _callback(samples, sampleCount, hostTime);
    }
}

- (uint64_t)cmTimeToHostTime:(CMTime)cmTime {
    // CMTime to seconds, then to mach_absolute_time
    // This assumes CMTime is relative to system uptime (host time base)
    if (CMTIME_IS_INVALID(cmTime)) {
        return mach_absolute_time();
    }

    Float64 seconds = CMTimeGetSeconds(cmTime);
    uint64_t nanos = (uint64_t)(seconds * 1e9);
    uint64_t hostTime = (uint64_t)(nanos / _timebaseNanos);

    return hostTime;
}

@end

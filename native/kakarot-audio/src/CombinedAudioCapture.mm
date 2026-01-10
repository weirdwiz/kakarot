#import "CombinedAudioCapture.h"
#import "MicrophoneCapture.h"
#import "SystemAudioCapture.h"
#import "WebRtcAECWrapper.h"
#import "AudioSyncBuffer.h"
#import <mach/mach_time.h>
#import <Accelerate/Accelerate.h>

@implementation SynchronizedAudioFrame
@end

@implementation CombinedAudioConfig

+ (instancetype)defaultConfig {
    CombinedAudioConfig *config = [[CombinedAudioConfig alloc] init];
    config.sampleRate = 48000;
    config.chunkDurationMs = 256;
    config.channels = 1;
    config.enableAEC = YES;
    config.bypassAECOnHeadphones = YES;
    config.syncToleranceMs = 10;
    return config;
}

@end

@interface CombinedAudioCapture () {
    CombinedAudioConfig *_config;
    SynchronizedAudioCallback _callback;

    MicrophoneCapture *_micCapture;
    SystemAudioCapture *_systemCapture;
    id<IAECProcessor> _aecProcessor;

    std::unique_ptr<AudioSyncBuffer> _syncBuffer;

    BOOL _isCapturing;
    dispatch_queue_t _processingQueue;
    dispatch_source_t _pollTimer;

    // For RMS calculation
    double _timebaseNanos;
}
@end

@implementation CombinedAudioCapture

- (instancetype)initWithConfig:(CombinedAudioConfig *)config
                      callback:(SynchronizedAudioCallback)callback {
    self = [super init];
    if (self) {
        _config = config;
        _callback = [callback copy];
        _isCapturing = NO;
        _processingQueue = dispatch_queue_create("com.kakarot.combined-audio",
                                                  DISPATCH_QUEUE_SERIAL);

        // Get mach timebase
        mach_timebase_info_data_t info;
        mach_timebase_info(&info);
        _timebaseNanos = (double)info.numer / (double)info.denom;
    }
    return self;
}

- (void)dealloc {
    [self stop];
}

- (void)setCustomAECProcessor:(id<IAECProcessor>)processor {
    if (_isCapturing) {
        NSLog(@"CombinedAudioCapture: Cannot set AEC processor while capturing");
        return;
    }
    _aecProcessor = processor;
}

- (BOOL)start:(NSError **)error {
    if (_isCapturing) {
        return YES;
    }

    // Calculate frame size
    size_t frameSizeSamples = (size_t)(_config.sampleRate * _config.chunkDurationMs / 1000);

    // Initialize sync buffer
    _syncBuffer = std::make_unique<AudioSyncBuffer>(
        frameSizeSamples,
        (uint32_t)_config.sampleRate,
        _config.syncToleranceMs,
        500.0  // 500ms max buffer
    );

    // Initialize AEC if enabled and not custom
    if (_config.enableAEC && !_aecProcessor) {
        WebRtcAECWrapper *aec = [[WebRtcAECWrapper alloc] init];
        NSError *aecError = nil;
        if ([aec initializeWithSampleRate:_config.sampleRate
                                 channels:_config.channels
                                    error:&aecError]) {
            _aecProcessor = aec;
            NSLog(@"CombinedAudioCapture: WebRTC AEC initialized");
        } else {
            NSLog(@"CombinedAudioCapture: WebRTC AEC initialization failed: %@", aecError);
            // Continue without AEC
        }
    }

    // Set capturing flag BEFORE starting captures (callbacks may fire immediately)
    _isCapturing = YES;

    // Initialize mic capture
    __weak CombinedAudioCapture *weakSelf = self;

    _micCapture = [[MicrophoneCapture alloc]
        initWithSampleRate:_config.sampleRate
          bufferSizeSamples:(UInt32)frameSizeSamples
                   callback:^(const int16_t *samples, size_t count, uint64_t timestamp) {
        [weakSelf handleMicAudio:samples count:count timestamp:timestamp];
    }];

    NSError *micError = nil;
    if (![_micCapture start:&micError]) {
        if (error) {
            *error = micError;
        }
        _isCapturing = NO;
        [self cleanup];
        return NO;
    }

    // Initialize system audio capture
    if (@available(macOS 13.0, *)) {
        _systemCapture = [[SystemAudioCapture alloc]
            initWithSampleRate:_config.sampleRate
                      callback:^(const int16_t *samples, size_t count, uint64_t timestamp) {
            [weakSelf handleSystemAudio:samples count:count timestamp:timestamp];
        }];

        NSError *sysError = nil;
        if (![_systemCapture start:&sysError]) {
            if (error) {
                *error = sysError;
            }
            _isCapturing = NO;
            [self cleanup];
            return NO;
        }
    } else {
        if (error) {
            *error = [NSError errorWithDomain:@"CombinedAudioCapture"
                                         code:-1
                                     userInfo:@{NSLocalizedDescriptionKey: @"macOS 13.0+ required for system audio"}];
        }
        _isCapturing = NO;
        [self cleanup];
        return NO;
    }

    // Start polling timer for synchronized output
    _pollTimer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,
                                        0, 0, _processingQueue);
    dispatch_source_set_timer(_pollTimer,
                              dispatch_time(DISPATCH_TIME_NOW, 0),
                              10 * NSEC_PER_MSEC,  // Poll every 10ms
                              1 * NSEC_PER_MSEC);  // 1ms leeway

    dispatch_source_set_event_handler(_pollTimer, ^{
        [weakSelf pollSyncBuffer];
    });

    dispatch_resume(_pollTimer);

    return YES;
}

- (void)stop {
    if (!_isCapturing) {
        return;
    }

    _isCapturing = NO;

    // Stop timer
    if (_pollTimer) {
        dispatch_source_cancel(_pollTimer);
        _pollTimer = nil;
    }

    // Stop captures
    [_micCapture stop];
    _micCapture = nil;

    [_systemCapture stop];
    _systemCapture = nil;

    // Cleanup AEC
    if (_aecProcessor) {
        [_aecProcessor cleanup];
        _aecProcessor = nil;
    }

    _syncBuffer.reset();
}

- (void)handleMicAudio:(const int16_t *)samples
                 count:(size_t)count
             timestamp:(uint64_t)timestamp {
    if (!_isCapturing || !_syncBuffer) {
        NSLog(@"CombinedAudioCapture: handleMicAudio skipped (capturing=%d, buffer=%d)", _isCapturing, _syncBuffer != nullptr);
        return;
    }

    static int micCount = 0;
    if (++micCount % 100 == 1) {
        NSLog(@"CombinedAudioCapture: handleMicAudio count=%zu ts=%llu (total=%d)", count, timestamp, micCount);
    }

    // Process mic through AEC IMMEDIATELY as it arrives
    // This ensures continuous streaming to AEC3 which handles delay internally
    if (_aecProcessor) {
        // Make a mutable copy for AEC processing
        std::vector<int16_t> processedSamples(samples, samples + count);
        [_aecProcessor processCapture:processedSamples.data()
                                count:processedSamples.size()
                            timestamp:timestamp];
        // Feed the processed (echo-cancelled) audio to sync buffer
        _syncBuffer->feedMic(processedSamples.data(), count, timestamp);
    } else {
        _syncBuffer->feedMic(samples, count, timestamp);
    }
}

- (void)handleSystemAudio:(const int16_t *)samples
                    count:(size_t)count
                timestamp:(uint64_t)timestamp {
    if (!_isCapturing || !_syncBuffer) {
        NSLog(@"CombinedAudioCapture: handleSystemAudio skipped");
        return;
    }

    static int sysCount = 0;
    if (++sysCount % 100 == 1) {
        NSLog(@"CombinedAudioCapture: handleSystemAudio count=%zu ts=%llu (total=%d)", count, timestamp, sysCount);
    }

    // Feed system audio to AEC as reference IMMEDIATELY
    // AEC3 is "delay agnostic" - it handles the delay estimation internally
    // Both streams must be fed continuously for AEC3 to work
    if (_aecProcessor) {
        [_aecProcessor feedReferenceAudio:samples count:count timestamp:timestamp];
    }

    _syncBuffer->feedSystem(samples, count, timestamp);
}

- (void)pollSyncBuffer {
    if (!_isCapturing || !_syncBuffer || !_callback) {
        return;
    }

    static int pollCount = 0;
    pollCount++;

    // Get all available aligned frames
    while (auto frame = _syncBuffer->getAlignedFrame()) {
        static int frameCount = 0;
        if (++frameCount % 50 == 1) {
            NSLog(@"CombinedAudioCapture: emitting frame %d (hasMic=%d, hasSys=%d)",
                  frameCount, frame->has_mic, frame->has_system);
        }
        SynchronizedAudioFrame *output = [[SynchronizedAudioFrame alloc] init];
        output.timestamp = frame->timestamp;
        output.hasMic = frame->has_mic;
        output.hasSystem = frame->has_system;

        // AEC processing now happens in handleMicAudio and handleSystemAudio
        // The sync buffer contains already-processed audio

        // Process mic data (already AEC-processed)
        if (frame->has_mic && !frame->mic_data.empty()) {
            // Calculate RMS level
            output.micLevel = [self calculateRMS:frame->mic_data.data() count:frame->mic_data.size()];

            // Convert to NSData
            output.micData = [NSData dataWithBytes:frame->mic_data.data()
                                            length:frame->mic_data.size() * sizeof(int16_t)];
        }

        if (frame->has_system && !frame->system_data.empty()) {
            output.systemLevel = [self calculateRMS:frame->system_data.data()
                                              count:frame->system_data.size()];
            output.systemData = [NSData dataWithBytes:frame->system_data.data()
                                               length:frame->system_data.size() * sizeof(int16_t)];
        }

        // Dispatch callback
        dispatch_async(dispatch_get_main_queue(), ^{
            self->_callback(output);
        });
    }
}

- (float)calculateRMS:(const int16_t *)samples count:(size_t)count {
    if (count == 0) return 0.0f;

    float sumSquares = 0.0f;
    for (size_t i = 0; i < count; i++) {
        float normalized = samples[i] / 32768.0f;
        sumSquares += normalized * normalized;
    }

    float rms = sqrtf(sumSquares / count);
    // Scale for better visualization
    return fminf(1.0f, rms * 3.0f);
}

- (void)cleanup {
    [_micCapture stop];
    _micCapture = nil;

    [_systemCapture stop];
    _systemCapture = nil;

    if (_aecProcessor) {
        [_aecProcessor cleanup];
        _aecProcessor = nil;
    }

    _syncBuffer.reset();
}

- (id<IAECProcessor>)aecProcessor {
    return _aecProcessor;
}

@end

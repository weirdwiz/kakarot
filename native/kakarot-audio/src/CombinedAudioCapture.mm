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
        return;
    }
    _aecProcessor = processor;
}

- (BOOL)start:(NSError **)error {
    if (_isCapturing) {
        return YES;
    }

    size_t frameSizeSamples = (size_t)(_config.sampleRate * _config.chunkDurationMs / 1000);

    _syncBuffer = std::make_unique<AudioSyncBuffer>(
        frameSizeSamples,
        (uint32_t)_config.sampleRate,
        _config.syncToleranceMs,
        500.0
    );

    if (_config.enableAEC && !_aecProcessor) {
        WebRtcAECWrapper *aec = [[WebRtcAECWrapper alloc] init];
        NSError *aecError = nil;
        if ([aec initializeWithSampleRate:_config.sampleRate
                                 channels:_config.channels
                                    error:&aecError]) {
            _aecProcessor = aec;
        }
    }

    _isCapturing = YES;

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
                                     userInfo:@{NSLocalizedDescriptionKey: @"macOS 13.0+ required"}];
        }
        _isCapturing = NO;
        [self cleanup];
        return NO;
    }

    _pollTimer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, _processingQueue);
    dispatch_source_set_timer(_pollTimer,
                              dispatch_time(DISPATCH_TIME_NOW, 0),
                              10 * NSEC_PER_MSEC,
                              1 * NSEC_PER_MSEC);

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

    if (_pollTimer) {
        dispatch_source_cancel(_pollTimer);
        _pollTimer = nil;
    }

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

- (void)handleMicAudio:(const int16_t *)samples
                 count:(size_t)count
             timestamp:(uint64_t)timestamp {
    if (!_isCapturing || !_syncBuffer) {
        return;
    }

    if (_aecProcessor) {
        std::vector<int16_t> processedSamples(samples, samples + count);
        [_aecProcessor processCapture:processedSamples.data()
                                count:processedSamples.size()
                            timestamp:timestamp];
        _syncBuffer->feedMic(processedSamples.data(), count, timestamp);
    } else {
        _syncBuffer->feedMic(samples, count, timestamp);
    }
}

- (void)handleSystemAudio:(const int16_t *)samples
                    count:(size_t)count
                timestamp:(uint64_t)timestamp {
    if (!_isCapturing || !_syncBuffer) {
        return;
    }

    if (_aecProcessor) {
        [_aecProcessor feedReferenceAudio:samples count:count timestamp:timestamp];
    }

    _syncBuffer->feedSystem(samples, count, timestamp);
}

- (void)pollSyncBuffer {
    if (!_isCapturing || !_syncBuffer || !_callback) {
        return;
    }

    while (auto frame = _syncBuffer->getAlignedFrame()) {
        SynchronizedAudioFrame *output = [[SynchronizedAudioFrame alloc] init];
        output.timestamp = frame->timestamp;
        output.hasMic = frame->has_mic;
        output.hasSystem = frame->has_system;

        if (frame->has_mic && !frame->mic_data.empty()) {
            output.micLevel = [self calculateRMS:frame->mic_data.data() count:frame->mic_data.size()];
            output.micData = [NSData dataWithBytes:frame->mic_data.data()
                                            length:frame->mic_data.size() * sizeof(int16_t)];
        }

        if (frame->has_system && !frame->system_data.empty()) {
            output.systemLevel = [self calculateRMS:frame->system_data.data()
                                              count:frame->system_data.size()];
            output.systemData = [NSData dataWithBytes:frame->system_data.data()
                                               length:frame->system_data.size() * sizeof(int16_t)];
        }

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

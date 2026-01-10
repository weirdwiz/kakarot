#import "MicrophoneCapture.h"
#import <AVFoundation/AVFoundation.h>
#import <mach/mach_time.h>
#include <vector>

/**
 * MicrophoneCapture using AVAudioEngine.
 * Simple and reliable mic capture without built-in AEC.
 * AEC is handled separately by WebRtcAEC.
 *
 * Resamples from hardware native rate (e.g. 44100Hz) to target rate (48000Hz)
 * to match system audio sample rate for AEC processing.
 */

@interface MicrophoneCapture () {
    AVAudioEngine *_engine;
    Float64 _targetSampleRate;      // Requested sample rate (e.g. 48000)
    Float64 _nativeSampleRate;      // Hardware native rate (e.g. 44100)
    UInt32 _bufferSizeSamples;
    MicrophoneDataCallback _callback;
    BOOL _isCapturing;

    // Resampler
    AVAudioConverter *_converter;
    AVAudioFormat *_inputFormat;
    AVAudioFormat *_outputFormat;
    std::vector<int16_t> _resampleBuffer;
}
@end

@implementation MicrophoneCapture

- (instancetype)initWithSampleRate:(Float64)sampleRate
                  bufferSizeSamples:(UInt32)bufferSizeSamples
                           callback:(MicrophoneDataCallback)callback {
    self = [super init];
    if (self) {
        _targetSampleRate = sampleRate;
        _nativeSampleRate = sampleRate;  // Will be updated in start
        _bufferSizeSamples = bufferSizeSamples;
        _callback = [callback copy];
        _isCapturing = NO;
        _engine = nil;
        _converter = nil;
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

    _engine = [[AVAudioEngine alloc] init];
    AVAudioInputNode *inputNode = [_engine inputNode];

    // Get the native format
    AVAudioFormat *nativeFormat = [inputNode inputFormatForBus:0];
    if (!nativeFormat || nativeFormat.sampleRate == 0) {
        if (error) {
            *error = [NSError errorWithDomain:@"MicrophoneCapture"
                                         code:-1
                                     userInfo:@{NSLocalizedDescriptionKey: @"Could not get input format"}];
        }
        return NO;
    }

    _nativeSampleRate = nativeFormat.sampleRate;
    BOOL needsResampling = (_nativeSampleRate != _targetSampleRate);

    if (needsResampling) {
        NSLog(@"MicrophoneCapture: Will resample from %.0f to %.0f Hz",
              _nativeSampleRate, _targetSampleRate);

        // Create formats for resampling
        // Input: native rate, float32 (what AVAudioEngine provides internally)
        _inputFormat = [[AVAudioFormat alloc]
            initWithCommonFormat:AVAudioPCMFormatFloat32
                      sampleRate:_nativeSampleRate
                        channels:1
                     interleaved:NO];

        // Output: target rate, float32
        _outputFormat = [[AVAudioFormat alloc]
            initWithCommonFormat:AVAudioPCMFormatFloat32
                      sampleRate:_targetSampleRate
                        channels:1
                     interleaved:NO];

        // Create converter
        _converter = [[AVAudioConverter alloc] initFromFormat:_inputFormat
                                                     toFormat:_outputFormat];
        if (!_converter) {
            if (error) {
                *error = [NSError errorWithDomain:@"MicrophoneCapture"
                                             code:-2
                                         userInfo:@{NSLocalizedDescriptionKey: @"Could not create resampler"}];
            }
            return NO;
        }
    } else {
        NSLog(@"MicrophoneCapture: No resampling needed, native rate = %.0f", _nativeSampleRate);
    }

    // Tap format: capture at native rate in float32 for resampling
    AVAudioFormat *tapFormat = [[AVAudioFormat alloc]
        initWithCommonFormat:AVAudioPCMFormatFloat32
                  sampleRate:_nativeSampleRate
                    channels:1
                 interleaved:NO];

    // Install tap on input node
    __weak MicrophoneCapture *weakSelf = self;
    UInt32 bufferSize = _bufferSizeSamples;

    [inputNode installTapOnBus:0
                    bufferSize:bufferSize
                        format:tapFormat
                         block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
        MicrophoneCapture *strongSelf = weakSelf;
        if (!strongSelf || !strongSelf->_isCapturing || !strongSelf->_callback) {
            return;
        }

        // Get timestamp using mach_absolute_time for synchronization with system audio
        uint64_t hostTime = mach_absolute_time();

        static int tapCount = 0;
        if (++tapCount % 100 == 1) {
            NSLog(@"MicrophoneCapture: tap callback %u samples @ %.0fHz (total=%d)",
                  buffer.frameLength, strongSelf->_nativeSampleRate, tapCount);
        }

        // Resample if needed, then convert to int16 and deliver
        [strongSelf processBuffer:buffer timestamp:hostTime];
    }];

    // Prepare and start the engine
    NSError *startError = nil;
    [_engine prepare];

    if (![_engine startAndReturnError:&startError]) {
        if (error) {
            *error = startError ?: [NSError errorWithDomain:@"MicrophoneCapture"
                                                       code:-1
                                                   userInfo:@{NSLocalizedDescriptionKey: @"Failed to start audio engine"}];
        }
        [inputNode removeTapOnBus:0];
        _engine = nil;
        _converter = nil;
        return NO;
    }

    _isCapturing = YES;
    NSLog(@"MicrophoneCapture: Started with AVAudioEngine, native=%.0fHz, output=%.0fHz",
          _nativeSampleRate, _targetSampleRate);

    return YES;
}

- (void)processBuffer:(AVAudioPCMBuffer *)inputBuffer timestamp:(uint64_t)hostTime {
    const float *floatSamples = inputBuffer.floatChannelData[0];
    AVAudioFrameCount frameCount = inputBuffer.frameLength;

    AVAudioPCMBuffer *outputBuffer = nil;

    if (_converter) {
        // Resample: calculate output frame count
        double ratio = _targetSampleRate / _nativeSampleRate;
        AVAudioFrameCount outputFrameCount = (AVAudioFrameCount)ceil(frameCount * ratio);

        outputBuffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:_outputFormat
                                                     frameCapacity:outputFrameCount];
        outputBuffer.frameLength = outputFrameCount;

        // Perform conversion
        __block BOOL inputConsumed = NO;
        NSError *convertError = nil;

        AVAudioConverterOutputStatus status = [_converter convertToBuffer:outputBuffer
                                                                    error:&convertError
                                                   withInputFromBlock:^AVAudioBuffer * _Nullable(AVAudioPacketCount inNumberOfPackets,
                                                                                                   AVAudioConverterInputStatus * _Nonnull outStatus) {
            if (inputConsumed) {
                *outStatus = AVAudioConverterInputStatus_NoDataNow;
                return nil;
            }
            inputConsumed = YES;
            *outStatus = AVAudioConverterInputStatus_HaveData;
            return inputBuffer;
        }];

        if (status == AVAudioConverterOutputStatus_Error || convertError) {
            NSLog(@"MicrophoneCapture: Resample error: %@", convertError);
            return;
        }

        floatSamples = outputBuffer.floatChannelData[0];
        frameCount = outputBuffer.frameLength;
    }

    // Convert float32 to int16
    _resampleBuffer.resize(frameCount);
    for (AVAudioFrameCount i = 0; i < frameCount; i++) {
        float sample = floatSamples[i];
        // Clamp
        if (sample > 1.0f) sample = 1.0f;
        if (sample < -1.0f) sample = -1.0f;
        _resampleBuffer[i] = (int16_t)(sample * 32767.0f);
    }

    // Deliver to callback
    _callback(_resampleBuffer.data(), frameCount, hostTime);
}

- (void)stop {
    if (!_isCapturing) {
        return;
    }

    _isCapturing = NO;

    if (_engine) {
        [[_engine inputNode] removeTapOnBus:0];
        [_engine stop];
        _engine = nil;
    }

    _converter = nil;
    _inputFormat = nil;
    _outputFormat = nil;

    NSLog(@"MicrophoneCapture: stopped");
}

- (Float64)actualSampleRate {
    // Return the target sample rate since we resample to it
    return _targetSampleRate;
}

@end

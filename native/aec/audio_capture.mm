/**
 * Audio Capture Module - Implementation
 * Native macOS audio capture with WebRTC AEC3 echo cancellation
 * 
 * Using NLMS stub implementation (will upgrade to full WebRTC later)
 */

#import "audio_capture.h"
#import "system_audio_listener.h"

// Use the WebRTC stub implementation
#include "webrtc_stub.h"
#define HAS_WEBRTC 1

#include <vector>
#include <mutex>

@interface CombinedAudioCapture () {
    std::unique_ptr<webrtc::EchoCanceller3> _aec3;
    AudioUnit _microphoneAudioUnit;
    AudioDeviceID _micDeviceID;
    AudioDeviceIOProcID _micProcID;
    BOOL _isCapturingMicrophone;
    BOOL _isCapturingSystemAudio;
    BOOL _aecEnabled;
    
    SystemAudioListener* _systemAudioListener;
    AudioCaptureCallback _callback;
    
    std::vector<float> _micBuffer;
    std::vector<float> _renderBuffer;
    std::mutex _bufferMutex;
}

- (void)processMicrophoneBuffer:(const float*)buffer 
                     frameCount:(size_t)frameCount 
                      timestamp:(uint64_t)timestamp;
- (void)processSystemBuffer:(const float*)buffer 
                 frameCount:(size_t)frameCount 
                  timestamp:(uint64_t)timestamp;

@end

// Microphone audio callback (C function) - called by Core Audio
static OSStatus microphoneIOProc(
    AudioDeviceID inDevice,
    const AudioTimeStamp* inNow,
    const AudioBufferList* inInputData,
    const AudioTimeStamp* inInputTime,
    AudioBufferList* outOutputData,
    const AudioTimeStamp* inOutputTime,
    void* inClientData
) {
    CombinedAudioCapture* capture = (__bridge CombinedAudioCapture*)inClientData;
    
    if (capture && inInputData && inInputData->mNumberBuffers > 0) {
        const AudioBuffer* buffer = &inInputData->mBuffers[0];
        if (buffer->mData && buffer->mDataByteSize > 0) {
            size_t frameCount = buffer->mDataByteSize / sizeof(float);
            [capture processMicrophoneBuffer:(const float*)buffer->mData
                                  frameCount:frameCount
                                   timestamp:inInputTime->mHostTime];
        }
    }
    
    return noErr;
}

@implementation CombinedAudioCapture

- (instancetype)initWithSampleRate:(int)sampleRate 
    enableAutomaticGainCompensation:(BOOL)enableAGC {
    self = [super init];
    if (self) {
        _sampleRate = sampleRate;
        _enableAutomaticGainCompensation = enableAGC;
        _disableEchoCancellationOnHeadphones = YES;
        _outputDeviceIsHeadphones = NO;
        _isCapturingMicrophone = NO;
        _isCapturingSystemAudio = NO;
        _aecEnabled = YES;
        _micDeviceID = 0;
        _micProcID = NULL;
        
        [self initializeWebRTCAEC3];
        [self detectHeadphones];
    }
    return self;
}

- (void)initializeWebRTCAEC3 {
    NSLog(@"[AEC3] 🎛️ Initializing NLMS Echo Canceller (stub)");
    
    webrtc::EchoCanceller3Config config;
    config.delay.default_delay = 5;
    config.delay.down_sampling_factor = 4;
    config.delay.num_filters = 5;
    config.filter.main.length_blocks = 12;
    config.filter.shadow.length_blocks = 12;
    config.filter.main_initial.length_blocks = 12;
    config.filter.shadow_initial.length_blocks = 12;
    config.suppressor.high_bands_suppression.enr_transparent = 1.0f;
    config.suppressor.high_bands_suppression.enr_suppress = 4.0f;
    
    _aec3 = std::make_unique<webrtc::EchoCanceller3>(
        config, _sampleRate, 1, 1
    );
    
    NSLog(@"[AEC3] ✅ Echo canceller initialized successfully");
    
    const int samples_per_10ms = _sampleRate / 100;
    _micBuffer.resize(samples_per_10ms);
    _renderBuffer.resize(samples_per_10ms * 2);
}

- (void)detectHeadphones {
    AudioObjectPropertyAddress propertyAddress = {
        kAudioHardwarePropertyDefaultOutputDevice,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };
    
    AudioDeviceID outputDevice = 0;
    UInt32 dataSize = sizeof(outputDevice);
    
    OSStatus status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject, &propertyAddress, 0, NULL, &dataSize, &outputDevice
    );
    
    if (status != noErr) return;
    
    propertyAddress.mSelector = kAudioDevicePropertyTransportType;
    UInt32 transportType = 0;
    dataSize = sizeof(transportType);
    
    status = AudioObjectGetPropertyData(
        outputDevice, &propertyAddress, 0, NULL, &dataSize, &transportType
    );
    
    if (status == noErr) {
        _outputDeviceIsHeadphones = (
            transportType == kAudioDeviceTransportTypeUSB ||
            transportType == kAudioDeviceTransportTypeBluetooth ||
            transportType == kAudioDeviceTransportTypeBluetoothLE
        );
        
        NSLog(@"[Audio] Output device transport type: 0x%x, isHeadphones: %@",
              transportType, _outputDeviceIsHeadphones ? @"YES" : @"NO");
    }
}

- (BOOL)checkHeadphonesConnected {
    [self detectHeadphones];
    return _outputDeviceIsHeadphones;
}

- (void)setAECEnabled:(BOOL)enabled {
    _aecEnabled = enabled;
    NSLog(@"[AEC3] AEC %@", enabled ? @"enabled" : @"disabled");
}

- (void)startCapturingWithCallback:(AudioCaptureCallback)callback {
    _callback = [callback copy];
    
    NSLog(@"[Audio] 🎤 Starting dual audio capture...");
    
    [self setupMicrophoneCapture];
    [self setupSystemAudioCapture];
}

- (void)setupMicrophoneCapture {
    NSLog(@"[Mic] Initializing microphone capture...");
    
    // Get default input device
    AudioObjectPropertyAddress propertyAddress = {
        kAudioHardwarePropertyDefaultInputDevice,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };
    
    UInt32 dataSize = sizeof(_micDeviceID);
    OSStatus status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject, &propertyAddress, 0, NULL, &dataSize, &_micDeviceID
    );
    
    if (status != noErr || _micDeviceID == 0) {
        NSLog(@"[Mic] ❌ Failed to get default input device: %d", (int)status);
        return;
    }
    
    NSLog(@"[Mic] Using input device ID: %u", _micDeviceID);
    
    // Create IOProc for the microphone
    status = AudioDeviceCreateIOProcID(
        _micDeviceID,
        microphoneIOProc,
        (__bridge void*)self,
        &_micProcID
    );
    
    if (status != noErr) {
        NSLog(@"[Mic] ❌ Failed to create IOProc: %d", (int)status);
        _micDeviceID = 0;
        return;
    }
    
    // Start the microphone
    status = AudioDeviceStart(_micDeviceID, _micProcID);
    
    if (status != noErr) {
        NSLog(@"[Mic] ❌ Failed to start microphone: %d", (int)status);
        AudioDeviceDestroyIOProcID(_micDeviceID, _micProcID);
        _micDeviceID = 0;
        _micProcID = NULL;
        return;
    }
    
    _isCapturingMicrophone = YES;
    NSLog(@"[Mic] ✅ Microphone capture started");
}

- (void)setupSystemAudioCapture {
    NSLog(@"[System] Starting system audio capture...");
    
    _systemAudioListener = [[SystemAudioListener alloc] init];
    
    __weak CombinedAudioCapture* weakSelf = self;
    [_systemAudioListener setupTapWithCallback:^(AudioBufferList* bufferList, 
                                                  const AudioTimeStamp* timestamp) {
        CombinedAudioCapture* strongSelf = weakSelf;
        if (strongSelf && bufferList && bufferList->mNumberBuffers > 0) {
            const AudioBuffer* buffer = &bufferList->mBuffers[0];
            if (buffer->mData && buffer->mDataByteSize > 0) {
                size_t frameCount = buffer->mDataByteSize / sizeof(float);
                [strongSelf processSystemBuffer:(const float*)buffer->mData 
                                     frameCount:frameCount
                                      timestamp:timestamp->mHostTime];
            }
        }
    }];
    
    _isCapturingSystemAudio = YES;
}

- (void)processMicrophoneBuffer:(const float*)buffer 
                     frameCount:(size_t)frameCount 
                      timestamp:(uint64_t)timestamp {
    if (!_callback) return;
    
    std::lock_guard<std::mutex> lock(_bufferMutex);
    
    // Send raw mic audio
    _callback(buffer, frameCount, timestamp, @"microphone");
    
    // Apply AEC and send processed audio
    if (_aecEnabled && _aec3 && !_outputDeviceIsHeadphones) {
        // Apply NLMS echo cancellation
        std::vector<float> processedBuffer(buffer, buffer + frameCount);
        _aec3->ProcessCapture(processedBuffer.data(), frameCount);
        _callback(processedBuffer.data(), frameCount, timestamp, @"processed");
    } else {
        // No AEC (headphones or disabled), just pass through
        _callback(buffer, frameCount, timestamp, @"processed");
    }
}

- (void)processSystemBuffer:(const float*)buffer 
                 frameCount:(size_t)frameCount 
                  timestamp:(uint64_t)timestamp {
    if (!_callback) return;
    
    std::lock_guard<std::mutex> lock(_bufferMutex);
    
    if (_aecEnabled && _aec3 && !_outputDeviceIsHeadphones) {
        // Feed system audio to AEC as render (reference) signal
        _aec3->AnalyzeRender(buffer, frameCount);
    }
    
    _callback(buffer, frameCount, timestamp, @"system");
}

- (void)stopCapturing {
    NSLog(@"[Audio] Stopping capture...");
    
    // Stop microphone
    if (_isCapturingMicrophone && _micDeviceID != 0) {
        if (_micProcID != NULL) {
            AudioDeviceStop(_micDeviceID, _micProcID);
            AudioDeviceDestroyIOProcID(_micDeviceID, _micProcID);
            _micProcID = NULL;
        }
        _micDeviceID = 0;
        _isCapturingMicrophone = NO;
        NSLog(@"[Mic] ✅ Microphone stopped");
    }
    
    // Stop system audio
    if (_isCapturingSystemAudio && _systemAudioListener) {
        [_systemAudioListener stop];
        _systemAudioListener = nil;
        _isCapturingSystemAudio = NO;
        NSLog(@"[System] ✅ System audio stopped");
    }
    
    _callback = nil;
    NSLog(@"[Audio] ✅ All capture stopped");
}

- (BOOL)isCapturing {
    return _isCapturingMicrophone || _isCapturingSystemAudio;
}

@end

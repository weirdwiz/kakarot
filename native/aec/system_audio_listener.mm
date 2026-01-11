/**
 * System Audio Listener - Implementation
 * Captures system audio on macOS
 * 
 * This implementation uses a loopback device approach (e.g., BlackHole, Soundflower)
 * for reliable system audio capture. The Process Tap API is a private API with
 * undocumented signatures that can crash.
 * 
 * For reliable system audio capture, users should install a loopback driver:
 * - BlackHole: https://existential.audio/blackhole/
 * - Soundflower: https://github.com/mattingalls/Soundflower
 */

#import "system_audio_listener.h"

// Forward declaration for the C callback
static OSStatus systemAudioIOProc(
    AudioDeviceID inDevice,
    const AudioTimeStamp* inNow,
    const AudioBufferList* inInputData,
    const AudioTimeStamp* inInputTime,
    AudioBufferList* outOutputData,
    const AudioTimeStamp* inOutputTime,
    void* inClientData
);

@implementation SystemAudioListener {
    AudioDeviceID _captureDeviceID;
    AudioDeviceIOProcID _procID;
    BOOL _isCapturing;
    SystemAudioCallback _callback;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _captureDeviceID = 0;
        _procID = NULL;
        _isCapturing = NO;
    }
    return self;
}

- (void)setupTapWithCallback:(SystemAudioCallback)callback {
    _callback = [callback copy];
    
    NSLog(@"[SystemAudio] 🎧 Setting up system audio capture...");
    
    // Try to find a loopback device first (BlackHole, Soundflower, etc.)
    AudioDeviceID loopbackDevice = [self findLoopbackDevice];
    
    if (loopbackDevice != 0) {
        NSLog(@"[SystemAudio] Found loopback device: %u", loopbackDevice);
        [self setupCaptureFromDevice:loopbackDevice];
    } else {
        NSLog(@"[SystemAudio] ⚠️ No loopback device found");
        NSLog(@"[SystemAudio] ℹ️ For system audio capture, please install:");
        NSLog(@"[SystemAudio]    • BlackHole: https://existential.audio/blackhole/");
        NSLog(@"[SystemAudio]    • Or Soundflower");
        NSLog(@"[SystemAudio] ℹ️ Then set it as the system audio output in:");
        NSLog(@"[SystemAudio]    System Settings → Sound → Output");
        
        // Try to use the default input device as a fallback
        // This won't capture system audio but allows the module to function
        [self setupDefaultInputFallback];
    }
}

- (AudioDeviceID)findLoopbackDevice {
    // Get list of all audio devices
    AudioObjectPropertyAddress propertyAddress = {
        kAudioHardwarePropertyDevices,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };
    
    UInt32 dataSize = 0;
    OSStatus status = AudioObjectGetPropertyDataSize(
        kAudioObjectSystemObject,
        &propertyAddress,
        0,
        NULL,
        &dataSize
    );
    
    if (status != noErr) {
        NSLog(@"[SystemAudio] Failed to get device list size: %d", (int)status);
        return 0;
    }
    
    UInt32 deviceCount = dataSize / sizeof(AudioDeviceID);
    AudioDeviceID* devices = (AudioDeviceID*)malloc(dataSize);
    
    status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject,
        &propertyAddress,
        0,
        NULL,
        &dataSize,
        devices
    );
    
    if (status != noErr) {
        NSLog(@"[SystemAudio] Failed to get device list: %d", (int)status);
        free(devices);
        return 0;
    }
    
    AudioDeviceID loopbackDevice = 0;
    
    // Search for known loopback devices
    for (UInt32 i = 0; i < deviceCount; i++) {
        AudioDeviceID device = devices[i];
        
        // Get device name
        CFStringRef deviceName = NULL;
        propertyAddress.mSelector = kAudioObjectPropertyName;
        dataSize = sizeof(deviceName);
        
        status = AudioObjectGetPropertyData(
            device,
            &propertyAddress,
            0,
            NULL,
            &dataSize,
            &deviceName
        );
        
        if (status == noErr && deviceName) {
            NSString* name = (__bridge NSString*)deviceName;
            
            // Check for known loopback device names
            if ([name containsString:@"BlackHole"] ||
                [name containsString:@"Soundflower"] ||
                [name containsString:@"Loopback"] ||
                [name containsString:@"Virtual Audio"]) {
                
                // Verify it has input capabilities
                if ([self deviceHasInputCapability:device]) {
                    NSLog(@"[SystemAudio] Found loopback device: %@ (ID: %u)", name, device);
                    loopbackDevice = device;
                    CFRelease(deviceName);
                    break;
                }
            }
            
            CFRelease(deviceName);
        }
    }
    
    free(devices);
    return loopbackDevice;
}

- (BOOL)deviceHasInputCapability:(AudioDeviceID)device {
    AudioObjectPropertyAddress propertyAddress = {
        kAudioDevicePropertyStreamConfiguration,
        kAudioDevicePropertyScopeInput,
        kAudioObjectPropertyElementMain
    };
    
    UInt32 dataSize = 0;
    OSStatus status = AudioObjectGetPropertyDataSize(
        device,
        &propertyAddress,
        0,
        NULL,
        &dataSize
    );
    
    if (status != noErr || dataSize == 0) {
        return NO;
    }
    
    AudioBufferList* bufferList = (AudioBufferList*)malloc(dataSize);
    status = AudioObjectGetPropertyData(
        device,
        &propertyAddress,
        0,
        NULL,
        &dataSize,
        bufferList
    );
    
    BOOL hasInput = (status == noErr && bufferList->mNumberBuffers > 0);
    free(bufferList);
    
    return hasInput;
}

- (void)setupCaptureFromDevice:(AudioDeviceID)deviceID {
    _captureDeviceID = deviceID;
    
    // Create IOProc for the device
    OSStatus status = AudioDeviceCreateIOProcID(
        _captureDeviceID,
        systemAudioIOProc,
        (__bridge void*)self,
        &_procID
    );
    
    if (status != noErr) {
        NSLog(@"[SystemAudio] ❌ Failed to create IOProc: %d", (int)status);
        _captureDeviceID = 0;
        return;
    }
    
    // Start the device
    status = AudioDeviceStart(_captureDeviceID, _procID);
    
    if (status != noErr) {
        NSLog(@"[SystemAudio] ❌ Failed to start device: %d", (int)status);
        AudioDeviceDestroyIOProcID(_captureDeviceID, _procID);
        _captureDeviceID = 0;
        _procID = NULL;
        return;
    }
    
    _isCapturing = YES;
    NSLog(@"[SystemAudio] ✅ System audio capture started");
}

- (void)setupDefaultInputFallback {
    NSLog(@"[SystemAudio] Using default input device as fallback");
    
    // Get default input device
    AudioObjectPropertyAddress propertyAddress = {
        kAudioHardwarePropertyDefaultInputDevice,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };
    
    AudioDeviceID inputDevice = 0;
    UInt32 dataSize = sizeof(inputDevice);
    
    OSStatus status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject,
        &propertyAddress,
        0,
        NULL,
        &dataSize,
        &inputDevice
    );
    
    if (status != noErr || inputDevice == 0) {
        NSLog(@"[SystemAudio] ❌ Failed to get default input device: %d", (int)status);
        return;
    }
    
    // Note: This captures from the microphone, NOT system audio
    // It's just a fallback to allow the module to function
    NSLog(@"[SystemAudio] ⚠️ Capturing from input device (not system audio)");
    [self setupCaptureFromDevice:inputDevice];
}

- (void)handleAudioBuffer:(const AudioBufferList*)bufferList timestamp:(const AudioTimeStamp*)timestamp {
    if (_callback && bufferList && bufferList->mNumberBuffers > 0) {
        // Create a mutable copy for the callback
        AudioBufferList* mutableList = (AudioBufferList*)malloc(
            sizeof(AudioBufferList) + sizeof(AudioBuffer) * (bufferList->mNumberBuffers - 1)
        );
        
        if (mutableList) {
            mutableList->mNumberBuffers = bufferList->mNumberBuffers;
            for (UInt32 i = 0; i < bufferList->mNumberBuffers; i++) {
                mutableList->mBuffers[i] = bufferList->mBuffers[i];
            }
            
            _callback(mutableList, timestamp);
            free(mutableList);
        }
    }
}

- (void)stop {
    if (!_isCapturing || _captureDeviceID == 0) {
        return;
    }
    
    NSLog(@"[SystemAudio] Stopping capture...");
    
    // Stop the IOProc
    if (_procID != NULL) {
        OSStatus status = AudioDeviceStop(_captureDeviceID, _procID);
        if (status != noErr) {
            NSLog(@"[SystemAudio] ⚠️ Failed to stop device: %d", (int)status);
        }
        
        status = AudioDeviceDestroyIOProcID(_captureDeviceID, _procID);
        if (status != noErr) {
            NSLog(@"[SystemAudio] ⚠️ Failed to destroy IOProc: %d", (int)status);
        }
        
        _procID = NULL;
    }
    
    _captureDeviceID = 0;
    _isCapturing = NO;
    
    NSLog(@"[SystemAudio] ✅ Capture stopped");
}

@end

// C callback function for audio device IOProc
static OSStatus systemAudioIOProc(
    AudioDeviceID inDevice,
    const AudioTimeStamp* inNow,
    const AudioBufferList* inInputData,
    const AudioTimeStamp* inInputTime,
    AudioBufferList* outOutputData,
    const AudioTimeStamp* inOutputTime,
    void* inClientData
) {
    SystemAudioListener* listener = (__bridge SystemAudioListener*)inClientData;
    
    if (listener && inInputData) {
        [listener handleAudioBuffer:inInputData timestamp:inInputTime];
    }
    
    return noErr;
}

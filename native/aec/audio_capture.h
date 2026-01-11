/**
 * Audio Capture Module - Header
 * Native macOS audio capture with WebRTC AEC3 echo cancellation
 * 
 * THIS USES WebRTC AEC3 - NOT NLMS!
 */

#ifndef AUDIO_CAPTURE_H
#define AUDIO_CAPTURE_H

#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <CoreAudio/CoreAudio.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Callback invoked when processed audio data is available.
 * @param buffer Float32 PCM samples
 * @param bufferSize Number of samples
 * @param timestamp Audio timestamp
 * @param source "microphone" or "system"
 */
typedef void (^AudioCaptureCallback)(const float* buffer, size_t bufferSize, 
                                     uint64_t timestamp, NSString* source);

/**
 * CombinedAudioCapture
 * Captures dual audio streams (microphone + system) and applies
 * WebRTC AEC3 echo cancellation.
 */
@interface CombinedAudioCapture : NSObject

@property (nonatomic, readonly) int sampleRate;
@property (nonatomic, assign) BOOL enableAutomaticGainCompensation;
@property (nonatomic, assign) BOOL disableEchoCancellationOnHeadphones;
@property (nonatomic, readonly) BOOL outputDeviceIsHeadphones;
@property (nonatomic, assign) BOOL aecEnabled;

- (instancetype)initWithSampleRate:(int)sampleRate
    enableAutomaticGainCompensation:(BOOL)enableAGC;

- (void)startCapturingWithCallback:(AudioCaptureCallback)callback;
- (void)stopCapturing;
- (BOOL)isCapturing;

- (BOOL)checkHeadphonesConnected;
- (void)setAECEnabled:(BOOL)enabled;

@end

NS_ASSUME_NONNULL_END

#endif /* AUDIO_CAPTURE_H */

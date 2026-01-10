#ifndef MICROPHONE_CAPTURE_H
#define MICROPHONE_CAPTURE_H

#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Callback for microphone audio data.
 * @param samples Pointer to int16_t PCM samples
 * @param count Number of samples
 * @param timestamp mach_absolute_time when captured
 */
typedef void (^MicrophoneDataCallback)(const int16_t *samples,
                                       size_t count,
                                       uint64_t timestamp);

/**
 * CoreAudio-based microphone capture.
 *
 * Uses AudioUnit for low-latency mic input with precise timestamps.
 * Timestamps use AudioTimeStamp.mHostTime (mach_absolute_time).
 */
@interface MicrophoneCapture : NSObject

/**
 * Initialize microphone capture.
 * @param sampleRate Target sample rate (e.g., 48000)
 * @param bufferSizeSamples Buffer size in samples
 * @param callback Called on audio thread with captured data
 */
- (instancetype)initWithSampleRate:(Float64)sampleRate
                  bufferSizeSamples:(UInt32)bufferSizeSamples
                           callback:(MicrophoneDataCallback)callback;

/**
 * Start capturing.
 * @param error Error output if start fails
 * @return YES if started successfully
 */
- (BOOL)start:(NSError **)error;

/**
 * Stop capturing.
 */
- (void)stop;

/**
 * Check if currently capturing.
 */
@property (nonatomic, readonly) BOOL isCapturing;

/**
 * Get the actual sample rate (may differ from requested).
 */
@property (nonatomic, readonly) Float64 actualSampleRate;

@end

NS_ASSUME_NONNULL_END

#endif /* MICROPHONE_CAPTURE_H */

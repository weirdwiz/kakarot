#ifndef IAEC_PROCESSOR_H
#define IAEC_PROCESSOR_H

#import <Foundation/Foundation.h>

/**
 * Protocol for swappable AEC implementations.
 *
 * Start with VoiceProcessingAEC (Apple's built-in).
 * Can swap to WebRTCAEC later for better quality.
 */
@protocol IAECProcessor <NSObject>

/**
 * Initialize the AEC processor.
 * @param sampleRate Audio sample rate (e.g., 48000)
 * @param channels Number of channels (1 for mono)
 * @return YES if initialization succeeded
 */
- (BOOL)initializeWithSampleRate:(Float64)sampleRate
                        channels:(UInt32)channels
                           error:(NSError **)error;

/**
 * Feed reference (system/speaker) audio to the AEC.
 * This is the audio playing through speakers that may cause echo.
 * @param samples Pointer to int16_t PCM samples
 * @param count Number of samples
 * @param timestamp Host time (mach_absolute_time) when captured
 */
- (void)feedReferenceAudio:(const int16_t *)samples
                     count:(size_t)count
                 timestamp:(uint64_t)timestamp;

/**
 * Process microphone audio to remove echo.
 * Modifies samples in place.
 * @param samples Pointer to int16_t PCM samples (modified in place)
 * @param count Number of samples
 * @param timestamp Host time when captured
 */
- (void)processCapture:(int16_t *)samples
                 count:(size_t)count
             timestamp:(uint64_t)timestamp;

/**
 * Reset the AEC state (e.g., on device change).
 */
- (void)reset;

/**
 * Clean up resources.
 */
- (void)cleanup;

/**
 * Check if AEC is currently active.
 */
@property (nonatomic, readonly) BOOL isActive;

/**
 * Check if headphones are connected (AEC may bypass).
 */
@property (nonatomic, readonly) BOOL headphonesConnected;

@end

#endif /* IAEC_PROCESSOR_H */

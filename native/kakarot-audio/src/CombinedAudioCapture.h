#ifndef COMBINED_AUDIO_CAPTURE_H
#define COMBINED_AUDIO_CAPTURE_H

#import <Foundation/Foundation.h>
#import "IAECProcessor.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Synchronized audio frame with both mic and system audio.
 */
@interface SynchronizedAudioFrame : NSObject

@property (nonatomic, strong, nullable) NSData *micData;      // int16_t PCM
@property (nonatomic, strong, nullable) NSData *systemData;   // int16_t PCM
@property (nonatomic, assign) uint64_t timestamp;             // mach_absolute_time
@property (nonatomic, assign) BOOL hasMic;
@property (nonatomic, assign) BOOL hasSystem;
@property (nonatomic, assign) float micLevel;                 // RMS level 0-1
@property (nonatomic, assign) float systemLevel;              // RMS level 0-1

@end

/**
 * Callback for synchronized audio frames.
 */
typedef void (^SynchronizedAudioCallback)(SynchronizedAudioFrame *frame);

/**
 * Configuration for combined audio capture.
 */
@interface CombinedAudioConfig : NSObject

@property (nonatomic, assign) Float64 sampleRate;           // Default: 48000
@property (nonatomic, assign) UInt32 chunkDurationMs;       // Default: 256
@property (nonatomic, assign) UInt32 channels;              // Default: 1 (mono)
@property (nonatomic, assign) BOOL enableAEC;               // Default: YES
@property (nonatomic, assign) BOOL bypassAECOnHeadphones;   // Default: YES
@property (nonatomic, assign) double syncToleranceMs;       // Default: 10

+ (instancetype)defaultConfig;

@end

/**
 * Combined audio capture with synchronized mic and system audio.
 *
 * Captures both streams with aligned timestamps and applies AEC.
 * Provides a single callback with synchronized frames.
 */
API_AVAILABLE(macos(13.0))
@interface CombinedAudioCapture : NSObject

/**
 * Initialize with configuration.
 * @param config Capture configuration
 * @param callback Called with synchronized audio frames
 */
- (instancetype)initWithConfig:(CombinedAudioConfig *)config
                      callback:(SynchronizedAudioCallback)callback;

/**
 * Start capturing both mic and system audio.
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
 * Get current AEC processor (for metrics/debugging).
 */
@property (nonatomic, readonly, nullable) id<IAECProcessor> aecProcessor;

/**
 * Set a custom AEC processor (for swapping implementations).
 * Must be called before start().
 */
- (void)setCustomAECProcessor:(id<IAECProcessor>)processor;

@end

NS_ASSUME_NONNULL_END

#endif /* COMBINED_AUDIO_CAPTURE_H */

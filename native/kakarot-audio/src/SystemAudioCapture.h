#ifndef SYSTEM_AUDIO_CAPTURE_H
#define SYSTEM_AUDIO_CAPTURE_H

#import <Foundation/Foundation.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Callback for system audio data.
 * @param samples Pointer to int16_t PCM samples
 * @param count Number of samples
 * @param timestamp mach_absolute_time when captured
 */
typedef void (^SystemAudioDataCallback)(const int16_t *samples,
                                        size_t count,
                                        uint64_t timestamp);

/**
 * ScreenCaptureKit-based system audio capture.
 *
 * Captures system audio loopback using macOS 13.0+ ScreenCaptureKit.
 * Audio-only capture (no video) for minimal overhead.
 */
API_AVAILABLE(macos(13.0))
@interface SystemAudioCapture : NSObject <SCStreamDelegate, SCStreamOutput>

/**
 * Initialize system audio capture.
 * @param sampleRate Target sample rate (e.g., 48000)
 * @param callback Called with captured audio data
 */
- (instancetype)initWithSampleRate:(Float64)sampleRate
                          callback:(SystemAudioDataCallback)callback;

/**
 * Start capturing system audio.
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

@end

NS_ASSUME_NONNULL_END

#endif /* SYSTEM_AUDIO_CAPTURE_H */

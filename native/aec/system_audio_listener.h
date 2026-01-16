/**
 * System Audio Listener - Header
 * Captures system audio using AudioHardwareCreateProcessTap on macOS
 * 
 * THIS USES Process Tap - NOT ScreenCaptureKit!
 */

#ifndef SYSTEM_AUDIO_LISTENER_H
#define SYSTEM_AUDIO_LISTENER_H

#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <CoreAudio/CoreAudio.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^SystemAudioCallback)(AudioBufferList* bufferList, const AudioTimeStamp* timestamp);

@interface SystemAudioListener : NSObject

- (void)setupTapWithCallback:(SystemAudioCallback)callback;
- (void)stop;
- (void)handleAudioBuffer:(const AudioBufferList*)bufferList timestamp:(const AudioTimeStamp*)timestamp;

@end

NS_ASSUME_NONNULL_END

#endif /* SYSTEM_AUDIO_LISTENER_H */

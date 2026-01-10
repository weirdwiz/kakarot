#ifndef WEBRTC_AEC_WRAPPER_H
#define WEBRTC_AEC_WRAPPER_H

#import <Foundation/Foundation.h>
#import "IAECProcessor.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * WebRTC-based Acoustic Echo Cancellation.
 *
 * Uses WebRTC's AudioProcessing module for high-quality AEC.
 * This is the same approach used by Granola and other professional apps.
 */
@interface WebRtcAECWrapper : NSObject <IAECProcessor>

/**
 * Whether to bypass AEC processing entirely.
 * Use when headphones are detected.
 */
@property (nonatomic, assign) BOOL bypassEnabled;

@end

NS_ASSUME_NONNULL_END

#endif /* WEBRTC_AEC_WRAPPER_H */

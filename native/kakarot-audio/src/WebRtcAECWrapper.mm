#import "WebRtcAECWrapper.h"
#include "WebRtcAEC.h"
#include <memory>

@interface WebRtcAECWrapper () {
    std::unique_ptr<WebRtcAEC> _aec;
    BOOL _isActive;
    BOOL _headphonesConnected;
}
@end

@implementation WebRtcAECWrapper

@synthesize bypassEnabled = _bypassEnabled;

- (instancetype)init {
    self = [super init];
    if (self) {
        _aec = std::make_unique<WebRtcAEC>();
        _isActive = NO;
        _headphonesConnected = NO;
        _bypassEnabled = NO;
    }
    return self;
}

- (void)dealloc {
    [self cleanup];
}

- (BOOL)initializeWithSampleRate:(Float64)sampleRate
                        channels:(UInt32)channels
                           error:(NSError **)error {
    if (!_aec) {
        _aec = std::make_unique<WebRtcAEC>();
    }

    if (!_aec->initialize((int)sampleRate, (int)channels)) {
        if (error) {
            *error = [NSError errorWithDomain:@"WebRtcAECWrapper"
                                         code:-1
                                     userInfo:@{NSLocalizedDescriptionKey: @"Failed to initialize WebRTC AEC"}];
        }
        return NO;
    }

    _isActive = YES;
    NSLog(@"WebRtcAECWrapper: Initialized with sampleRate=%.0f channels=%u", sampleRate, (unsigned int)channels);
    return YES;
}

- (void)feedReferenceAudio:(const int16_t *)samples
                     count:(size_t)count
                 timestamp:(uint64_t)timestamp {
    if (!_isActive || _bypassEnabled || !_aec || !_aec->isInitialized()) {
        return;
    }

    _aec->feedReference(samples, count);
}

- (void)processCapture:(int16_t *)samples
                 count:(size_t)count
             timestamp:(uint64_t)timestamp {
    if (!_isActive || _bypassEnabled || !_aec || !_aec->isInitialized()) {
        return;
    }

    _aec->processCapture(samples, count);
}

- (void)reset {
    if (_aec && _aec->isInitialized()) {
        _aec->reset();
        NSLog(@"WebRtcAECWrapper: Reset");
    }
}

- (void)cleanup {
    _aec.reset();
    _isActive = NO;
    NSLog(@"WebRtcAECWrapper: Cleanup");
}

- (BOOL)isActive {
    return _isActive;
}

- (BOOL)headphonesConnected {
    return _headphonesConnected;
}

@end

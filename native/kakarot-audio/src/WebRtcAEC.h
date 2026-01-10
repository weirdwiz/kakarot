#ifndef WEBRTC_AEC_H
#define WEBRTC_AEC_H

#include <cstdint>
#include <cstddef>
#include <memory>
#include <deque>
#include <vector>

#include "api/audio/audio_processing.h"
#include "api/scoped_refptr.h"

class WebRtcAEC {
public:
    WebRtcAEC();
    ~WebRtcAEC();

    bool initialize(int sampleRate, int channels);
    void feedReference(const int16_t* samples, size_t count);
    void processCapture(int16_t* samples, size_t count);
    void reset();
    bool isInitialized() const { return initialized_; }

    struct Stats {
        int framesProcessed;
        bool hasEcho;
    };
    Stats getStats() const;

private:
    void processDelayedCapture();

    rtc::scoped_refptr<webrtc::AudioProcessing> apm_;
    std::unique_ptr<webrtc::StreamConfig> streamConfig_;

    int sampleRate_;
    int channels_;
    int frameSize_;
    bool initialized_;
    int framesProcessed_;

    static constexpr int kMicDelayMs = 100;
    std::deque<int16_t> micDelayBuffer_;
    size_t micDelayTarget_;
    std::vector<int16_t> pendingOutput_;
};

#endif

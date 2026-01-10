#include "WebRtcAEC.h"

#include <cstring>
#include <algorithm>
#include <vector>

WebRtcAEC::WebRtcAEC()
    : apm_(nullptr)
    , sampleRate_(0)
    , channels_(0)
    , frameSize_(0)
    , initialized_(false)
    , framesProcessed_(0)
    , micDelayTarget_(0) {
}

WebRtcAEC::~WebRtcAEC() {
    apm_ = nullptr;
}

bool WebRtcAEC::initialize(int sampleRate, int channels) {
    if (sampleRate != 8000 && sampleRate != 16000 &&
        sampleRate != 32000 && sampleRate != 48000) {
        return false;
    }

    rtc::scoped_refptr<webrtc::AudioProcessing> apm =
        webrtc::AudioProcessingBuilder().Create();

    if (!apm) {
        return false;
    }

    webrtc::AudioProcessing::Config config;
    config.echo_canceller.enabled = true;
    config.echo_canceller.mobile_mode = false;
    config.high_pass_filter.enabled = true;
    config.noise_suppression.enabled = false;
    config.gain_controller1.enabled = false;
    config.gain_controller2.enabled = false;

    apm->ApplyConfig(config);
    apm_ = apm;

    sampleRate_ = sampleRate;
    channels_ = channels;
    frameSize_ = sampleRate / 100;

    streamConfig_ = std::make_unique<webrtc::StreamConfig>(sampleRate, channels);

    micDelayTarget_ = (size_t)(sampleRate_ * kMicDelayMs / 1000);
    micDelayBuffer_.clear();
    pendingOutput_.clear();

    initialized_ = true;
    framesProcessed_ = 0;

    return true;
}

void WebRtcAEC::feedReference(const int16_t* samples, size_t count) {
    if (!initialized_ || !apm_) {
        return;
    }

    size_t offset = 0;
    while (offset + static_cast<size_t>(frameSize_) <= count) {
        std::vector<int16_t> frame(samples + offset, samples + offset + frameSize_);

        apm_->ProcessReverseStream(
            frame.data(),
            *streamConfig_,
            *streamConfig_,
            frame.data()
        );

        offset += frameSize_;
        framesProcessed_++;
    }
}

void WebRtcAEC::processCapture(int16_t* samples, size_t count) {
    if (!initialized_ || !apm_) {
        return;
    }

    for (size_t i = 0; i < count; i++) {
        micDelayBuffer_.push_back(samples[i]);
    }

    processDelayedCapture();

    size_t toCopy = std::min(count, pendingOutput_.size());
    if (toCopy > 0) {
        memcpy(samples, pendingOutput_.data(), toCopy * sizeof(int16_t));
        pendingOutput_.erase(pendingOutput_.begin(), pendingOutput_.begin() + toCopy);
    }

    if (toCopy < count) {
        memset(samples + toCopy, 0, (count - toCopy) * sizeof(int16_t));
    }
}

void WebRtcAEC::processDelayedCapture() {
    while (micDelayBuffer_.size() >= micDelayTarget_ + frameSize_) {
        std::vector<int16_t> frame(frameSize_);
        for (int i = 0; i < frameSize_; i++) {
            frame[i] = micDelayBuffer_.front();
            micDelayBuffer_.pop_front();
        }

        apm_->set_stream_delay_ms(0);

        apm_->ProcessStream(
            frame.data(),
            *streamConfig_,
            *streamConfig_,
            frame.data()
        );

        pendingOutput_.insert(pendingOutput_.end(), frame.begin(), frame.end());
    }
}

void WebRtcAEC::reset() {
    framesProcessed_ = 0;
    micDelayBuffer_.clear();
    pendingOutput_.clear();
}

WebRtcAEC::Stats WebRtcAEC::getStats() const {
    Stats stats;
    stats.framesProcessed = framesProcessed_;
    stats.hasEcho = false;

    if (apm_ && initialized_) {
        auto apmStats = apm_->GetStatistics();
        if (apmStats.residual_echo_likelihood.has_value()) {
            stats.hasEcho = apmStats.residual_echo_likelihood.value() > 0.5f;
        }
    }

    return stats;
}

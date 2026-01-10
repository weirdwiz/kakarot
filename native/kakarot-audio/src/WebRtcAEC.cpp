#include "WebRtcAEC.h"

#include <cstring>
#include <cmath>
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
    // scoped_refptr automatically releases when reset
    apm_ = nullptr;
}

bool WebRtcAEC::initialize(int sampleRate, int channels) {
    // WebRTC APM supports these sample rates
    if (sampleRate != 8000 && sampleRate != 16000 &&
        sampleRate != 32000 && sampleRate != 48000) {
        return false;
    }

    // Create AudioProcessing instance using the new builder pattern
    rtc::scoped_refptr<webrtc::AudioProcessing> apm =
        webrtc::AudioProcessingBuilder().Create();

    if (!apm) {
        return false;
    }

    // Configure the audio processing - AEC3 is the default echo canceller
    webrtc::AudioProcessing::Config config;

    // Enable echo cancellation (uses AEC3 by default)
    config.echo_canceller.enabled = true;
    config.echo_canceller.mobile_mode = false;  // Use desktop mode for better quality

    // Enable high-pass filter to remove DC offset and low-frequency noise
    config.high_pass_filter.enabled = true;

    // DISABLE noise suppression to see true AEC effect
    // NS was masking the AEC ineffectiveness by suppressing all audio
    config.noise_suppression.enabled = false;

    // DISABLE automatic gain control - we want pure AEC, no level adjustment
    // AGC was masking AEC effectiveness by boosting quiet signals
    config.gain_controller1.enabled = false;
    config.gain_controller2.enabled = false;

    // Apply configuration
    apm->ApplyConfig(config);

    // Store the scoped_refptr
    apm_ = apm;

    sampleRate_ = sampleRate;
    channels_ = channels;
    frameSize_ = sampleRate / 100;  // 10ms worth of samples

    // Create stream config
    streamConfig_ = std::make_unique<webrtc::StreamConfig>(sampleRate, channels);

    // Calculate delay buffer target size (100ms worth of samples)
    micDelayTarget_ = (size_t)(sampleRate_ * kMicDelayMs / 1000);
    micDelayBuffer_.clear();
    pendingOutput_.clear();

    printf("AEC-INIT: sampleRate=%d, frameSize=%d, micDelayMs=%d, micDelayTarget=%zu samples\n",
           sampleRate_, frameSize_, kMicDelayMs, micDelayTarget_);

    initialized_ = true;
    framesProcessed_ = 0;

    return true;
}

void WebRtcAEC::feedReference(const int16_t* samples, size_t count) {
    if (!initialized_ || !apm_) {
        return;
    }

    // Process in 10ms frames (required by WebRTC APM)
    size_t offset = 0;
    int framesInCall = 0;
    static int totalRefFrames = 0;

    while (offset + static_cast<size_t>(frameSize_) <= count) {
        // ProcessReverseStream expects int16_t* for the input buffer
        // and uses the same buffer for output (in-place processing)
        std::vector<int16_t> frame(samples + offset, samples + offset + frameSize_);

        apm_->ProcessReverseStream(
            frame.data(),
            *streamConfig_,
            *streamConfig_,
            frame.data()
        );

        offset += frameSize_;
        framesInCall++;
        totalRefFrames++;
    }

    static int refLogCount = 0;
    if (++refLogCount % 50 == 1) {
        printf("AEC-REF: +%d frames, totalRef=%d, ratio=%.2f (ref/cap)\n",
               framesInCall, totalRefFrames,
               framesProcessed_ > 0 ? (float)totalRefFrames / framesProcessed_ : 0.0f);
    }
}

void WebRtcAEC::processCapture(int16_t* samples, size_t count) {
    if (!initialized_ || !apm_) {
        return;
    }

    // Add incoming samples to the delay buffer
    for (size_t i = 0; i < count; i++) {
        micDelayBuffer_.push_back(samples[i]);
    }

    // Process delayed samples and copy to output
    processDelayedCapture();

    // Copy processed samples back to the caller's buffer
    // The pendingOutput_ contains already-processed samples
    size_t toCopy = std::min(count, pendingOutput_.size());
    if (toCopy > 0) {
        memcpy(samples, pendingOutput_.data(), toCopy * sizeof(int16_t));
        pendingOutput_.erase(pendingOutput_.begin(), pendingOutput_.begin() + toCopy);
    }

    // If we don't have enough processed samples yet, zero-fill (during warmup)
    if (toCopy < count) {
        memset(samples + toCopy, 0, (count - toCopy) * sizeof(int16_t));
    }
}

void WebRtcAEC::processDelayedCapture() {
    // Only process if we have enough samples buffered (>= delayTarget)
    // This ensures reference audio has had time to be fed first
    while (micDelayBuffer_.size() >= micDelayTarget_ + frameSize_) {
        // Extract one frame worth of samples
        std::vector<int16_t> frame(frameSize_);
        for (int i = 0; i < frameSize_; i++) {
            frame[i] = micDelayBuffer_.front();
            micDelayBuffer_.pop_front();
        }

        // Calculate RMS BEFORE processing
        float rmsBefore = 0;
        for (int i = 0; i < frameSize_; i++) {
            float s = frame[i] / 32768.0f;
            rmsBefore += s * s;
        }
        rmsBefore = sqrtf(rmsBefore / frameSize_);

        // Set stream delay to 0 - AEC3 handles delay estimation
        apm_->set_stream_delay_ms(0);

        // Process the frame through AEC
        apm_->ProcessStream(
            frame.data(),
            *streamConfig_,
            *streamConfig_,
            frame.data()
        );

        framesProcessed_++;

        // Add processed samples to output buffer
        pendingOutput_.insert(pendingOutput_.end(), frame.begin(), frame.end());

        // Log periodically
        static int capLogCount = 0;
        if (++capLogCount % 20 == 1) {
            float rmsAfter = 0;
            for (int i = 0; i < frameSize_; i++) {
                float s = frame[i] / 32768.0f;
                rmsAfter += s * s;
            }
            rmsAfter = sqrtf(rmsAfter / frameSize_);
            float reduction = (rmsBefore > 0) ? ((rmsBefore - rmsAfter) / rmsBefore * 100.0f) : 0;

            auto apmStats = apm_->GetStatistics();
            float echoLikelihood = apmStats.residual_echo_likelihood.value_or(-1.0f);
            float echoReturn = apmStats.echo_return_loss.value_or(-1.0f);
            float echoReturnEnhancement = apmStats.echo_return_loss_enhancement.value_or(-1.0f);

            printf("AEC-CAP: delayed=%dms, bufSize=%zu, before=%.4f after=%.4f reduction=%.1f%% ERLE=%.1f\n",
                   kMicDelayMs, micDelayBuffer_.size(), rmsBefore, rmsAfter, reduction, echoReturnEnhancement);
        }
    }
}

void WebRtcAEC::reset() {
    // Reset counter and clear delay buffers
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
            // Consider echo present if likelihood > 0.5
            stats.hasEcho = apmStats.residual_echo_likelihood.value() > 0.5f;
        }
    }

    return stats;
}

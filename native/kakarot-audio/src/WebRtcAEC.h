#ifndef WEBRTC_AEC_H
#define WEBRTC_AEC_H

#include <cstdint>
#include <cstddef>
#include <memory>
#include <deque>
#include <vector>

// Include the actual WebRTC headers
#include "api/audio/audio_processing.h"
#include "api/scoped_refptr.h"

/**
 * WebRTC AEC3-based Acoustic Echo Cancellation wrapper.
 * Uses WebRTC's modern AudioProcessing module with AEC3 (the latest algorithm).
 *
 * Key improvements over the old AEC:
 * - Delay-agnostic operation (no manual delay estimation needed)
 * - Better convergence and adaptation
 * - Superior handling of double-talk
 * - Better non-linear echo suppression
 */
class WebRtcAEC {
public:
    WebRtcAEC();
    ~WebRtcAEC();

    /**
     * Initialize the AEC processor with AEC3.
     * @param sampleRate Sample rate in Hz (typically 16000, 32000, or 48000)
     * @param channels Number of audio channels (typically 1)
     * @return true on success, false on failure
     */
    bool initialize(int sampleRate, int channels);

    /**
     * Feed reference (far-end/system) audio to the AEC.
     * This is the audio playing through speakers that might be picked up by mic.
     * Must be called BEFORE processCapture for each audio frame.
     * @param samples Pointer to 16-bit PCM samples
     * @param count Number of samples
     */
    void feedReference(const int16_t* samples, size_t count);

    /**
     * Process capture (near-end/mic) audio, removing echo.
     * @param samples Pointer to 16-bit PCM samples (modified in-place)
     * @param count Number of samples
     */
    void processCapture(int16_t* samples, size_t count);

    /**
     * Reset the AEC state (e.g., after a configuration change).
     */
    void reset();

    /**
     * Check if AEC is initialized and ready.
     */
    bool isInitialized() const { return initialized_; }

    /**
     * Get processing statistics.
     */
    struct Stats {
        int framesProcessed;
        bool hasEcho;  // Whether echo was detected in the last frame
    };
    Stats getStats() const;

private:
    void processDelayedCapture();  // Process samples from delay buffer

    rtc::scoped_refptr<webrtc::AudioProcessing> apm_;
    std::unique_ptr<webrtc::StreamConfig> streamConfig_;

    int sampleRate_;
    int channels_;
    int frameSize_;  // 10ms worth of samples
    bool initialized_;
    int framesProcessed_;

    // Mic delay buffer - holds mic samples for delayMs before processing
    static constexpr int kMicDelayMs = 100;  // 100ms delay to let reference catch up
    std::deque<int16_t> micDelayBuffer_;
    size_t micDelayTarget_;  // Number of samples to buffer (delayMs worth)
    std::vector<int16_t> pendingOutput_;  // Output buffer for caller
};

#endif // WEBRTC_AEC_H

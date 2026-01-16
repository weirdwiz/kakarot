#include "webrtc_stub.h"
#include <cmath>
#include <algorithm>
#include <iostream>

namespace webrtc {

// AudioBuffer implementation
AudioBuffer::AudioBuffer(int sample_rate_hz, int num_input_channels,
                        int sample_rate_hz2, int num_output_channels,
                        int sample_rate_hz3, int num_channels)
    : num_channels_(num_channels)
    , num_samples_(sample_rate_hz / 100) { // 10ms frames at given sample rate
    data_.resize(num_samples_ * num_channels_, 0.0f);
}

void AudioBuffer::CopyFrom(const float* data, int num_samples) {
    if (data && num_samples > 0) {
        num_samples_ = num_samples;
        data_.resize(num_samples_ * num_channels_);
        std::memcpy(data_.data(), data, num_samples * sizeof(float));
    }
}

void AudioBuffer::CopyTo(float** data) {
    if (data && data[0] && !data_.empty()) {
        std::memcpy(data[0], data_.data(), data_.size() * sizeof(float));
    }
}

// Config implementation
EchoCanceller3Config EchoCanceller3Config::CreateDefaultConfig(
    int sample_rate, int num_render_channels, int num_capture_channels) {
    return EchoCanceller3Config();
}

// EchoCanceller3 implementation
EchoCanceller3::EchoCanceller3(const EchoCanceller3Config& config,
                               int sample_rate_hz,
                               int num_render_channels,
                               int num_capture_channels)
    : sample_rate_hz_(sample_rate_hz)
    , num_capture_channels_(num_capture_channels)
    , filter_length_(2048)  // 2048 taps ≈ 42ms at 48kHz
    , learning_rate_(0.05f) // Conservative learning rate for stability
    , is_active_(true)
    , buffer_pos_(0) {
    
    filter_weights_.resize(filter_length_, 0.0f);
    render_buffer_.resize(filter_length_, 0.0f);
    
    std::cout << "[AEC-STUB] ✅ NLMS Echo Canceller initialized" << std::endl;
    std::cout << "[AEC-STUB]    Filter taps: " << filter_length_ << std::endl;
    std::cout << "[AEC-STUB]    Echo tail: ~" << (filter_length_ * 1000 / sample_rate_hz) << "ms" << std::endl;
    std::cout << "[AEC-STUB]    Learning rate: " << learning_rate_ << std::endl;
    std::cout << "[AEC-STUB]    ⚠️  Using stub - will upgrade to full WebRTC later" << std::endl;
}

EchoCanceller3::~EchoCanceller3() {
}

void EchoCanceller3::AnalyzeRender(const float* render_data, size_t num_samples) {
    if (!render_data || num_samples == 0) return;
    
    // Store render (speaker) audio in circular buffer
    for (size_t i = 0; i < num_samples && i < render_buffer_.size(); i++) {
        render_buffer_[buffer_pos_] = render_data[i];
        buffer_pos_ = (buffer_pos_ + 1) % filter_length_;
    }
}

void EchoCanceller3::ProcessCapture(float* capture_data, size_t num_samples) {
    if (!capture_data || num_samples == 0) return;
    
    // Apply NLMS echo cancellation
    ProcessFrame(render_buffer_.data(), capture_data, capture_data, num_samples);
}

void EchoCanceller3::ProcessFrame(const float* render, const float* capture,
                                  float* output, size_t frame_size) {
    for (size_t i = 0; i < frame_size; i++) {
        // 1. Estimate echo using current filter
        float echo_estimate = 0.0f;
        for (size_t j = 0; j < (size_t)filter_length_; j++) {
            size_t idx = (buffer_pos_ + filter_length_ - j - i) % filter_length_;
            echo_estimate += filter_weights_[j] * render_buffer_[idx];
        }
        
        // 2. Calculate error (desired signal = capture - echo)
        float error = capture[i] - echo_estimate;
        
        // 3. Apply soft clipping to prevent extreme values
        error = std::max(-2.0f, std::min(2.0f, error));
        output[i] = error;
        
        // 4. Calculate input power for normalization
        float power = 0.001f; // Regularization to prevent division by zero
        for (size_t j = 0; j < (size_t)filter_length_; j++) {
            size_t idx = (buffer_pos_ + filter_length_ - j - i) % filter_length_;
            float val = render_buffer_[idx];
            power += val * val;
        }
        
        // 5. Update filter weights using NLMS algorithm
        float step_size = learning_rate_ * error / power;
        
        for (size_t j = 0; j < (size_t)filter_length_; j++) {
            size_t idx = (buffer_pos_ + filter_length_ - j - i) % filter_length_;
            filter_weights_[j] += step_size * render_buffer_[idx];
            
            // Prevent weight explosion
            filter_weights_[j] = std::max(-1.5f, std::min(1.5f, filter_weights_[j]));
        }
    }
}

} // namespace webrtc

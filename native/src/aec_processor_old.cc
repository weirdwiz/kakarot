#include "aec_processor.h"
#include <cmath>
#include <algorithm>

namespace kakarot {

class AECProcessor::Impl {
public:
    explicit Impl(const AECConfig& config) : config_(config) {}
    
    bool Initialize(int sample_rate, int num_channels) {
        sample_rate_ = sample_rate;
        num_channels_ = num_channels;
        frame_size_ = (sample_rate * config_.frame_duration_ms) / 1000;

        render_buffer_.resize(frame_size_ * num_channels_);
        capture_buffer_.resize(frame_size_ * num_channels_);
        render_history_.resize(frame_size_ * 10);  // Keep 100ms history

        return true;
    }

    void ProcessRenderAudio(const float* data, size_t num_samples) {
        if (!config_.enable_aec) return;
        
        // Store render audio in history buffer for echo cancellation
        std::copy(data, data + std::min(num_samples, render_history_.size()), 
                  render_history_.begin());
    }

    void ProcessCaptureAudio(const float* input, float* output, size_t num_samples) {
        // Copy input to output
        std::copy(input, input + num_samples, output);
        
        if (!config_.enable_aec) {
            // Just apply high-pass filter and calculate metrics
            ApplyHighPassFilter(output, num_samples);
            CalculateMetrics(output, num_samples);
            return;
        }
        
        // Simple echo cancellation: subtract scaled render from capture
        for (size_t i = 0; i < num_samples && i < render_history_.size(); i++) {
            output[i] -= render_history_[i] * 0.5f;  // 50% echo reduction
        }
        
        // Apply high-pass filter
        ApplyHighPassFilter(output, num_samples);
        
        // Apply noise suppression if enabled
        if (config_.enable_ns) {
            ApplyNoiseSuppression(output, num_samples);
        }
        
        CalculateMetrics(output, num_samples);
    }

    void SetEchoCancellationEnabled(bool enabled) {
        config_.enable_aec = enabled;
    }

    AECMetrics GetMetrics() const {
        AECMetrics metrics;
        metrics.rms_level = current_rms_;
        metrics.peak_level = current_peak_;
        metrics.aec_converged = config_.enable_aec;
        metrics.echo_return_loss = config_.enable_aec ? 12.0f : 0.0f;  // Simulated
        
        return metrics;
    }

private:
    void ApplyHighPassFilter(float* data, size_t num_samples) {
        // Simple 1st order high-pass filter at 80Hz
        const float cutoff = 80.0f / sample_rate_;
        const float alpha = 1.0f / (1.0f + cutoff);
        
        for (size_t i = 1; i < num_samples; i++) {
            data[i] = alpha * (hp_prev_ + data[i] - data[i-1]);
            hp_prev_ = data[i];
        }
    }
    
    void ApplyNoiseSuppression(float* data, size_t num_samples) {
        // Simple noise gate
        const float threshold = 0.01f;
        for (size_t i = 0; i < num_samples; i++) {
            if (std::abs(data[i]) < threshold) {
                data[i] *= 0.1f;  // Reduce noise floor
            }
        }
    }
    
    void CalculateMetrics(const float* data, size_t num_samples) {
        float sum = 0.0f;
        float peak = 0.0f;
        for (size_t i = 0; i < num_samples; i++) {
            float val = std::abs(data[i]);
            sum += val * val;
            peak = std::max(peak, val);
        }
        current_rms_ = std::sqrt(sum / num_samples);
        current_peak_ = peak;
    }

    AECConfig config_;
    std::vector<float> render_buffer_;
    std::vector<float> capture_buffer_;
    std::vector<float> render_history_;
    int sample_rate_ = 0;
    int num_channels_ = 0;
    size_t frame_size_ = 0;
    float current_rms_ = 0.0f;
    float current_peak_ = 0.0f;
    float hp_prev_ = 0.0f;
};

AECProcessor::AECProcessor(const AECConfig& config) 
    : impl_(std::make_unique<Impl>(config)) {}

AECProcessor::~AECProcessor() = default;

bool AECProcessor::Initialize(int sample_rate, int num_channels) {
    return impl_->Initialize(sample_rate, num_channels);
}

void AECProcessor::ProcessRenderAudio(const float* data, size_t num_samples) {
    impl_->ProcessRenderAudio(data, num_samples);
}

void AECProcessor::ProcessCaptureAudio(const float* input, float* output, size_t num_samples) {
    impl_->ProcessCaptureAudio(input, output, num_samples);
}

void AECProcessor::SetEchoCancellationEnabled(bool enabled) {
    impl_->SetEchoCancellationEnabled(enabled);
}

AECMetrics AECProcessor::GetMetrics() const {
    return impl_->GetMetrics();
}

} // namespace kakarot

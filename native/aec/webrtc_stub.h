#ifndef WEBRTC_STUB_H
#define WEBRTC_STUB_H

#include <vector>
#include <memory>
#include <cstdint>
#include <cstring>

namespace webrtc {

// Minimal AudioBuffer implementation
class AudioBuffer {
public:
    AudioBuffer(int sample_rate_hz, int num_input_channels,
                int sample_rate_hz2, int num_output_channels,
                int sample_rate_hz3, int num_channels);
    ~AudioBuffer() = default;
    
    void CopyFrom(const float* data, int num_samples);
    void CopyTo(float** data);
    
    float* data() { return data_.data(); }
    const float* data() const { return data_.data(); }
    int num_samples() const { return num_samples_; }
    
private:
    std::vector<float> data_;
    int num_channels_;
    int num_samples_;
};

// StreamConfig for audio format
struct StreamConfig {
    int sample_rate_hz;
    int num_channels;
    
    StreamConfig(int rate, int channels) 
        : sample_rate_hz(rate), num_channels(channels) {}
};

// EchoCanceller3 configuration
struct EchoCanceller3Config {
    struct Delay {
        int default_delay = 5;
        int down_sampling_factor = 4;
        int num_filters = 5;
    } delay;
    
    struct Filter {
        struct SubConfig {
            int length_blocks = 12;
        };
        SubConfig main;
        SubConfig shadow;
        SubConfig main_initial;
        SubConfig shadow_initial;
    } filter;
    
    struct Suppressor {
        struct HighBands {
            float enr_transparent = 1.0f;
            float enr_suppress = 4.0f;
        } high_bands_suppression;
        
        struct Tuning {
            struct Mask {
                float enr_transparent = 1.0f;
                float enr_suppress = 3.0f;
            };
            Mask mask_lf;
            Mask mask_hf;
        } normal_tuning;
    } suppressor;
    
    static EchoCanceller3Config CreateDefaultConfig(int sample_rate, 
                                                     int num_render_channels,
                                                     int num_capture_channels);
};

// Main echo cancellation class using NLMS
class EchoCanceller3 {
public:
    EchoCanceller3(const EchoCanceller3Config& config,
                   int sample_rate_hz,
                   int num_render_channels,
                   int num_capture_channels);
    ~EchoCanceller3();
    
    // Feed render (speaker) audio
    void AnalyzeRender(const float* render_data, size_t num_samples);
    
    // Process and remove echo from capture
    void ProcessCapture(float* capture_data, size_t num_samples);
    
    // Check if AEC is active
    bool IsActive() const { return is_active_; }
    
private:
    int sample_rate_hz_;
    int num_capture_channels_;
    int filter_length_;
    float learning_rate_;
    bool is_active_;
    
    std::vector<float> filter_weights_;
    std::vector<float> render_buffer_;
    size_t buffer_pos_;
    
    // NLMS processing
    void ProcessFrame(const float* render, const float* capture, 
                     float* output, size_t frame_size);
};

} // namespace webrtc

#endif

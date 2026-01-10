#ifndef AUDIO_SYNC_BUFFER_H
#define AUDIO_SYNC_BUFFER_H

#include <cstdint>
#include <vector>
#include <deque>
#include <mutex>
#include <optional>

/**
 * Timestamp-aligned audio buffer for synchronized dual-stream capture.
 *
 * Both mic and system audio are captured with mach_absolute_time timestamps.
 * This buffer aligns them within a tolerance window and emits synchronized frames.
 */
class AudioSyncBuffer {
public:
    struct AudioFrame {
        std::vector<int16_t> data;
        uint64_t timestamp;  // mach_absolute_time
        bool is_mic;         // true = mic, false = system
    };

    struct AlignedFrame {
        std::vector<int16_t> mic_data;
        std::vector<int16_t> system_data;
        uint64_t timestamp;
        bool has_mic;
        bool has_system;
    };

    /**
     * Create a sync buffer.
     * @param frame_size_samples Number of samples per frame (e.g., 12288 for 256ms at 48kHz)
     * @param sample_rate Sample rate in Hz
     * @param tolerance_ms Maximum time difference for alignment (default 10ms)
     * @param max_buffer_ms Maximum buffer capacity (default 500ms)
     */
    AudioSyncBuffer(size_t frame_size_samples,
                    uint32_t sample_rate,
                    double tolerance_ms = 10.0,
                    double max_buffer_ms = 500.0);

    /**
     * Feed microphone audio.
     * @param samples PCM samples
     * @param count Number of samples
     * @param timestamp mach_absolute_time when captured
     */
    void feedMic(const int16_t* samples, size_t count, uint64_t timestamp);

    /**
     * Feed system audio.
     * @param samples PCM samples
     * @param count Number of samples
     * @param timestamp mach_absolute_time when captured
     */
    void feedSystem(const int16_t* samples, size_t count, uint64_t timestamp);

    /**
     * Try to get an aligned frame with both mic and system audio.
     * @return AlignedFrame if available, nullopt otherwise
     */
    std::optional<AlignedFrame> getAlignedFrame();

    /**
     * Get number of pending frames in buffer.
     */
    size_t pendingFrameCount() const;

    /**
     * Clear all buffered audio.
     */
    void reset();

private:
    // Convert mach_absolute_time to nanoseconds
    uint64_t hostTimeToNanos(uint64_t hostTime) const;

    // Check if two timestamps are within tolerance
    bool isWithinTolerance(uint64_t t1, uint64_t t2) const;

    // Accumulate samples into frames
    void accumulateFrame(const int16_t* samples, size_t count,
                        uint64_t timestamp, bool is_mic);

    // Try to match and emit aligned frames
    void tryMatchFrames();

    size_t frame_size_samples_;
    uint32_t sample_rate_;
    uint64_t tolerance_nanos_;
    size_t max_frames_;

    // Accumulated samples waiting to form complete frames
    std::vector<int16_t> mic_accumulator_;
    std::vector<int16_t> system_accumulator_;
    uint64_t mic_first_timestamp_ = 0;
    uint64_t system_first_timestamp_ = 0;

    // Complete frames waiting for alignment
    std::deque<AudioFrame> mic_frames_;
    std::deque<AudioFrame> system_frames_;

    // Aligned frames ready for consumption
    std::deque<AlignedFrame> output_queue_;

    mutable std::mutex mutex_;

    // For mach_absolute_time conversion
    double timebase_nanos_;
};

#endif /* AUDIO_SYNC_BUFFER_H */

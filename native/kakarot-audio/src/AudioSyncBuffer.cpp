#include "AudioSyncBuffer.h"
#include <mach/mach_time.h>
#include <algorithm>
#include <cmath>

AudioSyncBuffer::AudioSyncBuffer(size_t frame_size_samples,
                                 uint32_t sample_rate,
                                 double tolerance_ms,
                                 double max_buffer_ms)
    : frame_size_samples_(frame_size_samples)
    , sample_rate_(sample_rate)
    , tolerance_nanos_(static_cast<uint64_t>(tolerance_ms * 1e6))
    , max_frames_(static_cast<size_t>(max_buffer_ms / (1000.0 * frame_size_samples / sample_rate)))
{
    // Get mach timebase for converting host time to nanoseconds
    mach_timebase_info_data_t info;
    mach_timebase_info(&info);
    timebase_nanos_ = static_cast<double>(info.numer) / static_cast<double>(info.denom);

    // Reserve space for accumulators
    mic_accumulator_.reserve(frame_size_samples_ * 2);
    system_accumulator_.reserve(frame_size_samples_ * 2);
}

uint64_t AudioSyncBuffer::hostTimeToNanos(uint64_t hostTime) const {
    return static_cast<uint64_t>(hostTime * timebase_nanos_);
}

bool AudioSyncBuffer::isWithinTolerance(uint64_t t1, uint64_t t2) const {
    uint64_t n1 = hostTimeToNanos(t1);
    uint64_t n2 = hostTimeToNanos(t2);
    uint64_t diff = (n1 > n2) ? (n1 - n2) : (n2 - n1);
    return diff <= tolerance_nanos_;
}

void AudioSyncBuffer::feedMic(const int16_t* samples, size_t count, uint64_t timestamp) {
    std::lock_guard<std::mutex> lock(mutex_);
    accumulateFrame(samples, count, timestamp, true);
    tryMatchFrames();
}

void AudioSyncBuffer::feedSystem(const int16_t* samples, size_t count, uint64_t timestamp) {
    std::lock_guard<std::mutex> lock(mutex_);
    accumulateFrame(samples, count, timestamp, false);
    tryMatchFrames();
}

void AudioSyncBuffer::accumulateFrame(const int16_t* samples, size_t count,
                                      uint64_t timestamp, bool is_mic) {
    auto& accumulator = is_mic ? mic_accumulator_ : system_accumulator_;
    auto& first_timestamp = is_mic ? mic_first_timestamp_ : system_first_timestamp_;
    auto& frame_queue = is_mic ? mic_frames_ : system_frames_;

    // Record timestamp of first sample in accumulator
    if (accumulator.empty()) {
        first_timestamp = timestamp;
    }

    // Add samples to accumulator
    accumulator.insert(accumulator.end(), samples, samples + count);

    // Extract complete frames
    while (accumulator.size() >= frame_size_samples_) {
        AudioFrame frame;
        frame.data.assign(accumulator.begin(), accumulator.begin() + frame_size_samples_);
        frame.timestamp = first_timestamp;
        frame.is_mic = is_mic;

        frame_queue.push_back(std::move(frame));

        // Remove consumed samples
        accumulator.erase(accumulator.begin(), accumulator.begin() + frame_size_samples_);

        // Calculate timestamp for remaining samples
        // (advance by frame duration in host time units)
        double frame_duration_secs = static_cast<double>(frame_size_samples_) / sample_rate_;
        uint64_t frame_duration_nanos = static_cast<uint64_t>(frame_duration_secs * 1e9);
        uint64_t frame_duration_host = static_cast<uint64_t>(frame_duration_nanos / timebase_nanos_);
        first_timestamp += frame_duration_host;
    }

    // Bound queue size to prevent memory growth
    while (frame_queue.size() > max_frames_) {
        frame_queue.pop_front();
    }
}

void AudioSyncBuffer::tryMatchFrames() {
    // Try to pair mic and system frames by timestamp
    while (!mic_frames_.empty() && !system_frames_.empty()) {
        auto& mic = mic_frames_.front();
        auto& sys = system_frames_.front();

        if (isWithinTolerance(mic.timestamp, sys.timestamp)) {
            // Match found - emit aligned frame
            AlignedFrame aligned;
            aligned.mic_data = std::move(mic.data);
            aligned.system_data = std::move(sys.data);
            aligned.timestamp = std::min(mic.timestamp, sys.timestamp);
            aligned.has_mic = true;
            aligned.has_system = true;

            output_queue_.push_back(std::move(aligned));

            mic_frames_.pop_front();
            system_frames_.pop_front();
        } else {
            // No match - drop the older frame
            uint64_t mic_nanos = hostTimeToNanos(mic.timestamp);
            uint64_t sys_nanos = hostTimeToNanos(sys.timestamp);

            if (mic_nanos < sys_nanos) {
                // Mic is older - emit mic-only frame and drop
                AlignedFrame aligned;
                aligned.mic_data = std::move(mic.data);
                aligned.timestamp = mic.timestamp;
                aligned.has_mic = true;
                aligned.has_system = false;

                output_queue_.push_back(std::move(aligned));
                mic_frames_.pop_front();
            } else {
                // System is older - emit system-only frame and drop
                AlignedFrame aligned;
                aligned.system_data = std::move(sys.data);
                aligned.timestamp = sys.timestamp;
                aligned.has_mic = false;
                aligned.has_system = true;

                output_queue_.push_back(std::move(aligned));
                system_frames_.pop_front();
            }
        }
    }

    // Emit single-stream frames if one stream is inactive
    // This allows audio to flow even when only one source is capturing
    while (!mic_frames_.empty() && system_frames_.empty()) {
        auto& mic = mic_frames_.front();
        AlignedFrame aligned;
        aligned.mic_data = std::move(mic.data);
        aligned.timestamp = mic.timestamp;
        aligned.has_mic = true;
        aligned.has_system = false;
        output_queue_.push_back(std::move(aligned));
        mic_frames_.pop_front();
    }

    while (!system_frames_.empty() && mic_frames_.empty()) {
        auto& sys = system_frames_.front();
        AlignedFrame aligned;
        aligned.system_data = std::move(sys.data);
        aligned.timestamp = sys.timestamp;
        aligned.has_mic = false;
        aligned.has_system = true;
        output_queue_.push_back(std::move(aligned));
        system_frames_.pop_front();
    }

    // Bound output queue
    while (output_queue_.size() > max_frames_) {
        output_queue_.pop_front();
    }
}

std::optional<AudioSyncBuffer::AlignedFrame> AudioSyncBuffer::getAlignedFrame() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (output_queue_.empty()) {
        return std::nullopt;
    }

    AlignedFrame frame = std::move(output_queue_.front());
    output_queue_.pop_front();
    return frame;
}

size_t AudioSyncBuffer::pendingFrameCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return output_queue_.size();
}

void AudioSyncBuffer::reset() {
    std::lock_guard<std::mutex> lock(mutex_);

    mic_accumulator_.clear();
    system_accumulator_.clear();
    mic_first_timestamp_ = 0;
    system_first_timestamp_ = 0;
    mic_frames_.clear();
    system_frames_.clear();
    output_queue_.clear();
}

//! Acoustic Echo Cancellation native module using SpeexDSP via aec-rs.
//!
//! This module provides Neon bindings for acoustic echo cancellation.
//! It's designed to be loaded by the Kakarot Electron app.

use aec_rs::{Aec, AecConfig};
use neon::prelude::*;
use neon::types::buffer::TypedArray;
use std::cell::RefCell;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// Echo cancellation processor state.
struct AecProcessor {
    /// The aec-rs echo canceller instance.
    aec: Aec,
    /// Audio frame size in samples.
    frame_size: usize,
    /// Ring buffer for reference (far-end) audio.
    ref_buffer: Vec<i16>,
    /// Maximum reference buffer size.
    max_ref_size: usize,
    /// Total frames processed.
    total_frames: AtomicU64,
    /// Total processing time in microseconds.
    processing_time_us: AtomicU64,
}

impl AecProcessor {
    fn new(sample_rate: u32, frame_size: usize, filter_length: usize) -> Result<Self, String> {
        // Allow larger frame sizes - audio chunks can be up to 256ms at 48kHz (12288 samples)
        if frame_size == 0 || frame_size > 16384 {
            return Err(format!("Invalid frame size: {}", frame_size));
        }
        if filter_length < 64 || filter_length > 2048 {
            return Err(format!("Invalid filter length: {}", filter_length));
        }

        let config = AecConfig {
            sample_rate,
            frame_size,
            filter_length: filter_length as i32,
            enable_preprocess: false,
        };

        let aec = Aec::new(&config);

        Ok(Self {
            aec,
            frame_size,
            ref_buffer: Vec::with_capacity(filter_length * 4),
            max_ref_size: filter_length * 4,
            total_frames: AtomicU64::new(0),
            processing_time_us: AtomicU64::new(0),
        })
    }

    fn feed_reference(&mut self, samples: &[i16]) {
        self.ref_buffer.extend_from_slice(samples);

        // Keep buffer bounded
        if self.ref_buffer.len() > self.max_ref_size {
            let drain_count = self.ref_buffer.len() - self.max_ref_size / 2;
            self.ref_buffer.drain(0..drain_count);
        }
    }

    fn process(&mut self, input: &[i16]) -> Vec<i16> {
        let start = Instant::now();

        // Extract matching reference samples
        let ref_samples: Vec<i16> = if self.ref_buffer.len() >= input.len() {
            self.ref_buffer.drain(0..input.len()).collect()
        } else {
            // Not enough reference - use zeros (will pass through with minimal processing)
            vec![0i16; input.len()]
        };

        // Run echo cancellation
        let mut output = vec![0i16; input.len()];

        // Process in frame_size chunks
        let mut offset = 0;
        while offset + self.frame_size <= input.len() {
            let in_slice = &input[offset..offset + self.frame_size];
            let ref_slice = &ref_samples[offset..offset + self.frame_size];
            let out_slice = &mut output[offset..offset + self.frame_size];

            // aec-rs: cancel_echo(rec_buffer, echo_buffer, out_buffer)
            // rec_buffer = microphone input (what we want to clean)
            // echo_buffer = speaker output (reference signal)
            self.aec.cancel_echo(in_slice, ref_slice, out_slice);

            offset += self.frame_size;
        }

        // Handle remaining samples (shouldn't happen if frame sizes align)
        if offset < input.len() {
            output[offset..].copy_from_slice(&input[offset..]);
        }

        let elapsed_us = start.elapsed().as_micros() as u64;
        self.total_frames.fetch_add(1, Ordering::Relaxed);
        self.processing_time_us.fetch_add(elapsed_us, Ordering::Relaxed);

        output
    }

    fn reset(&mut self) {
        self.ref_buffer.clear();
        self.total_frames.store(0, Ordering::Relaxed);
        self.processing_time_us.store(0, Ordering::Relaxed);
    }

    fn get_metrics(&self) -> (u64, u64) {
        (
            self.total_frames.load(Ordering::Relaxed),
            self.processing_time_us.load(Ordering::Relaxed),
        )
    }
}

// Implement Finalize for AecProcessor (required for JsBox in neon 1.0)
impl Finalize for AecProcessor {}

// Wrap in RefCell for interior mutability (Neon JsBox requires this pattern)
type BoxedAec = JsBox<RefCell<AecProcessor>>;

/// Create a new AEC processor.
/// Arguments: sampleRate: number, frameSize: number, filterLength: number
/// Returns: AEC handle (opaque object)
fn create(mut cx: FunctionContext) -> JsResult<BoxedAec> {
    let sample_rate = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let frame_size = cx.argument::<JsNumber>(1)?.value(&mut cx) as usize;
    let filter_length = cx.argument::<JsNumber>(2)?.value(&mut cx) as usize;

    let processor = AecProcessor::new(sample_rate, frame_size, filter_length)
        .map_err(|e| cx.throw_error::<_, ()>(e).unwrap_err())?;

    Ok(cx.boxed(RefCell::new(processor)))
}

/// Feed reference (far-end/speaker) audio to the AEC.
/// Arguments: handle: AEC, buffer: Buffer (16-bit PCM samples)
fn feed_reference(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let handle = cx.argument::<BoxedAec>(0)?;
    let buffer = cx.argument::<JsBuffer>(1)?;

    let bytes = buffer.as_slice(&cx);
    let samples: Vec<i16> = bytes
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    handle.borrow_mut().feed_reference(&samples);
    Ok(cx.undefined())
}

/// Process microphone audio, removing echo.
/// Arguments: handle: AEC, buffer: Buffer (16-bit PCM samples)
/// Returns: Buffer (processed 16-bit PCM samples)
fn process(mut cx: FunctionContext) -> JsResult<JsBuffer> {
    let handle = cx.argument::<BoxedAec>(0)?;
    let buffer = cx.argument::<JsBuffer>(1)?;

    let bytes = buffer.as_slice(&cx);
    let input: Vec<i16> = bytes
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    let output = handle.borrow_mut().process(&input);

    let mut result = cx.buffer(output.len() * 2)?;
    {
        let out_bytes = result.as_mut_slice(&mut cx);
        for (i, sample) in output.iter().enumerate() {
            let sample_bytes = sample.to_le_bytes();
            out_bytes[i * 2] = sample_bytes[0];
            out_bytes[i * 2 + 1] = sample_bytes[1];
        }
    }

    Ok(result)
}

/// Get processing metrics.
/// Arguments: handle: AEC
/// Returns: { totalFrames: number, processingTimeUs: number }
fn get_metrics(mut cx: FunctionContext) -> JsResult<JsObject> {
    let handle = cx.argument::<BoxedAec>(0)?;
    let (total_frames, processing_time_us) = handle.borrow().get_metrics();

    let obj = cx.empty_object();

    let frames = cx.number(total_frames as f64);
    obj.set(&mut cx, "totalFrames", frames)?;

    let time = cx.number(processing_time_us as f64);
    obj.set(&mut cx, "processingTimeUs", time)?;

    Ok(obj)
}

/// Reset the AEC processor state.
/// Arguments: handle: AEC
fn reset(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let handle = cx.argument::<BoxedAec>(0)?;
    handle.borrow_mut().reset();
    Ok(cx.undefined())
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("create", create)?;
    cx.export_function("feedReference", feed_reference)?;
    cx.export_function("process", process)?;
    cx.export_function("getMetrics", get_metrics)?;
    cx.export_function("reset", reset)?;
    Ok(())
}

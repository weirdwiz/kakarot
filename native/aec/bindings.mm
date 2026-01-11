/**
 * N-API Bindings for Native Audio Capture with WebRTC AEC3
 * Exposes C++/Objective-C audio capture to Node.js
 */

#include <napi.h>
#import "audio_capture.h"
#include <memory>
#include <vector>

// Global instance
static CombinedAudioCapture* g_audioCapture = nil;
static Napi::ThreadSafeFunction g_tsfn;

struct AudioData {
    std::vector<float> buffer;
    uint64_t timestamp;
    std::string source;
    
    AudioData(const float* data, size_t size, uint64_t ts, NSString* src) 
        : buffer(data, data + size), timestamp(ts) {
        source = [src UTF8String];
    }
};

Napi::Value StartAudioCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: sampleRate, callback")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int sampleRate = info[0].As<Napi::Number>().Int32Value();
    Napi::Function callback = info[1].As<Napi::Function>();
    
    // Create thread-safe function
    g_tsfn = Napi::ThreadSafeFunction::New(
        env,
        callback,
        "AudioCaptureCallback",
        0,
        1
    );
    
    // Create audio capture
    if (g_audioCapture != nil) {
        [g_audioCapture stopCapturing];
        g_audioCapture = nil;
    }
    
    g_audioCapture = [[CombinedAudioCapture alloc] 
        initWithSampleRate:sampleRate 
        enableAutomaticGainCompensation:YES];
    
    // Start capture with callback
    [g_audioCapture startCapturingWithCallback:^(const float* buffer, 
                                                   size_t bufferSize, 
                                                   uint64_t timestamp, 
                                                   NSString* source) {
        auto jsCallback = [](Napi::Env env, Napi::Function jsCallback, AudioData* data) {
            // Convert float buffer to Float32Array
            Napi::Float32Array buffer = Napi::Float32Array::New(env, data->buffer.size());
            memcpy(buffer.Data(), data->buffer.data(), data->buffer.size() * sizeof(float));
            
            jsCallback.Call({
                buffer, 
                Napi::Number::New(env, static_cast<double>(data->timestamp)),
                Napi::String::New(env, data->source)
            });
            
            delete data;
        };
        
        auto* data = new AudioData(buffer, bufferSize, timestamp, source);
        g_tsfn.NonBlockingCall(data, jsCallback);
    }];
    
    return Napi::Boolean::New(env, true);
}

Napi::Value StopAudioCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // CRITICAL: Stop audio capture FIRST before releasing TSFN
    // This ensures no callbacks fire after TSFN is released
    if (g_audioCapture != nil) {
        [g_audioCapture stopCapturing];
        g_audioCapture = nil;
    }
    
    // Now safe to release the thread-safe function
    g_tsfn.Release();
    
    return Napi::Boolean::New(env, true);
}

Napi::Value IsHeadphonesConnected(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (g_audioCapture != nil) {
        return Napi::Boolean::New(env, [g_audioCapture checkHeadphonesConnected]);
    }
    
    return Napi::Boolean::New(env, false);
}

Napi::Value SetAECEnabled(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsBoolean()) {
        Napi::TypeError::New(env, "Expected boolean argument")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    
    bool enabled = info[0].As<Napi::Boolean>().Value();
    
    if (g_audioCapture != nil) {
        [g_audioCapture setAECEnabled:enabled];
    }
    
    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startAudioCapture", Napi::Function::New(env, StartAudioCapture));
    exports.Set("stopAudioCapture", Napi::Function::New(env, StopAudioCapture));
    exports.Set("isHeadphonesConnected", Napi::Function::New(env, IsHeadphonesConnected));
    exports.Set("setAECEnabled", Napi::Function::New(env, SetAECEnabled));
    // Alias for TypeScript compatibility
    exports.Set("setEchoCancellationEnabled", Napi::Function::New(env, SetAECEnabled));
    return exports;
}

NODE_API_MODULE(audio_capture_native, Init)

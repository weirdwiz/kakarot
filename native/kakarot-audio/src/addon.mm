#import <napi.h>
#import "CombinedAudioCapture.h"
#import <dispatch/dispatch.h>
#include <map>
#include <mutex>
#include <memory>
#include <vector>

/**
 * Node.js native addon for synchronized dual-stream audio capture.
 *
 * Provides:
 * - create(config) -> handle
 * - start(handle) -> Promise
 * - stop(handle)
 * - setCallback(handle, callback)
 * - isCapturing(handle) -> boolean
 */

// Store capture instances and their callbacks
struct CaptureInstance {
    CombinedAudioCapture *capture;
    Napi::ThreadSafeFunction tsfn;
    bool callbackSet;
};

static std::map<uint64_t, std::unique_ptr<CaptureInstance>> g_instances;
static uint64_t g_nextHandle = 1;
static std::mutex g_mutex;

/**
 * Create a new combined audio capture instance.
 *
 * @param config Object with:
 *   - sampleRate: number (default 48000)
 *   - chunkDurationMs: number (default 256)
 *   - channels: number (default 1)
 *   - enableAEC: boolean (default true)
 *   - bypassAECOnHeadphones: boolean (default true)
 * @returns handle (number)
 */
Napi::Value Create(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    CombinedAudioConfig *config = [CombinedAudioConfig defaultConfig];

    // Parse config if provided
    if (info.Length() > 0 && info[0].IsObject()) {
        Napi::Object jsConfig = info[0].As<Napi::Object>();

        if (jsConfig.Has("sampleRate")) {
            config.sampleRate = jsConfig.Get("sampleRate").As<Napi::Number>().DoubleValue();
        }
        if (jsConfig.Has("chunkDurationMs")) {
            config.chunkDurationMs = jsConfig.Get("chunkDurationMs").As<Napi::Number>().Uint32Value();
        }
        if (jsConfig.Has("channels")) {
            config.channels = jsConfig.Get("channels").As<Napi::Number>().Uint32Value();
        }
        if (jsConfig.Has("enableAEC")) {
            config.enableAEC = jsConfig.Get("enableAEC").As<Napi::Boolean>().Value();
        }
        if (jsConfig.Has("bypassAECOnHeadphones")) {
            config.bypassAECOnHeadphones = jsConfig.Get("bypassAECOnHeadphones").As<Napi::Boolean>().Value();
        }
    }

    // Create instance
    auto instance = std::make_unique<CaptureInstance>();
    instance->callbackSet = false;

    // We'll set the capture when start is called
    instance->capture = nil;

    std::lock_guard<std::mutex> lock(g_mutex);
    uint64_t handle = g_nextHandle++;

    // Store config temporarily (we'll use it in start)
    // For now, create capture immediately
    instance->capture = [[CombinedAudioCapture alloc]
        initWithConfig:config
              callback:^(SynchronizedAudioFrame *frame) {
        // Callback will be set up separately
    }];

    g_instances[handle] = std::move(instance);

    return Napi::Number::New(env, (double)handle);
}

/**
 * Set the callback for audio data.
 *
 * @param handle number
 * @param callback function(frame: { mic?: Buffer, system?: Buffer, timestamp: number, micLevel: number, systemLevel: number })
 */
Napi::Value SetCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected handle and callback").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint64_t handle = (uint64_t)info[0].As<Napi::Number>().Int64Value();
    Napi::Function callback = info[1].As<Napi::Function>();

    std::lock_guard<std::mutex> lock(g_mutex);

    auto it = g_instances.find(handle);
    if (it == g_instances.end()) {
        Napi::Error::New(env, "Invalid handle").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Create thread-safe function
    it->second->tsfn = Napi::ThreadSafeFunction::New(
        env,
        callback,
        "AudioCallback",
        0,  // Unlimited queue
        1   // 1 thread
    );
    it->second->callbackSet = true;

    return env.Undefined();
}

/**
 * Start capturing audio.
 *
 * @param handle number
 * @returns Promise<void>
 */
Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected handle").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint64_t handle = (uint64_t)info[0].As<Napi::Number>().Int64Value();

    // Create deferred promise
    auto deferred = std::make_shared<Napi::Promise::Deferred>(Napi::Promise::Deferred::New(env));

    std::lock_guard<std::mutex> lock(g_mutex);

    auto it = g_instances.find(handle);
    if (it == g_instances.end()) {
        deferred->Reject(Napi::Error::New(env, "Invalid handle").Value());
        return deferred->Promise();
    }

    CaptureInstance* instance = it->second.get();

    // Recreate capture with callback if callback is set
    if (instance->callbackSet) {
        CombinedAudioConfig *config = [CombinedAudioConfig defaultConfig];

        // Get reference to tsfn
        Napi::ThreadSafeFunction tsfn = instance->tsfn;

        instance->capture = [[CombinedAudioCapture alloc]
            initWithConfig:config
                  callback:^(SynchronizedAudioFrame *frame) {
            // Copy data BEFORE async call to avoid autorelease issues
            uint64_t timestamp = frame.timestamp;
            bool hasMic = frame.hasMic;
            bool hasSystem = frame.hasSystem;
            float micLevel = frame.micLevel;
            float systemLevel = frame.systemLevel;

            // Deep copy the audio data
            std::vector<char> micData;
            std::vector<char> systemData;

            if (frame.micData) {
                const char *bytes = (const char *)frame.micData.bytes;
                size_t len = frame.micData.length;
                micData.assign(bytes, bytes + len);
            }

            if (frame.systemData) {
                const char *bytes = (const char *)frame.systemData.bytes;
                size_t len = frame.systemData.length;
                systemData.assign(bytes, bytes + len);
            }

            // Call JavaScript callback via thread-safe function
            auto callback = [timestamp, hasMic, hasSystem, micLevel, systemLevel,
                           micData = std::move(micData), systemData = std::move(systemData)]
                          (Napi::Env env, Napi::Function jsCallback) {
                Napi::Object jsFrame = Napi::Object::New(env);

                jsFrame.Set("timestamp", Napi::Number::New(env, (double)timestamp));
                jsFrame.Set("hasMic", Napi::Boolean::New(env, hasMic));
                jsFrame.Set("hasSystem", Napi::Boolean::New(env, hasSystem));
                jsFrame.Set("micLevel", Napi::Number::New(env, micLevel));
                jsFrame.Set("systemLevel", Napi::Number::New(env, systemLevel));

                if (!micData.empty()) {
                    Napi::Buffer<char> buffer = Napi::Buffer<char>::Copy(env, micData.data(), micData.size());
                    jsFrame.Set("mic", buffer);
                }

                if (!systemData.empty()) {
                    Napi::Buffer<char> buffer = Napi::Buffer<char>::Copy(env, systemData.data(), systemData.size());
                    jsFrame.Set("system", buffer);
                }

                jsCallback.Call({jsFrame});
            };

            tsfn.BlockingCall(callback);
        }];
    }

    // Start capture
    NSError *error = nil;
    if ([instance->capture start:&error]) {
        deferred->Resolve(env.Undefined());
    } else {
        std::string errorMsg = error ? [error.localizedDescription UTF8String] : "Unknown error";
        deferred->Reject(Napi::Error::New(env, errorMsg).Value());
    }

    return deferred->Promise();
}

/**
 * Stop capturing audio.
 *
 * @param handle number
 */
Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected handle").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint64_t handle = (uint64_t)info[0].As<Napi::Number>().Int64Value();

    std::lock_guard<std::mutex> lock(g_mutex);

    auto it = g_instances.find(handle);
    if (it == g_instances.end()) {
        return env.Undefined();
    }

    [it->second->capture stop];

    return env.Undefined();
}

/**
 * Destroy a capture instance.
 *
 * @param handle number
 */
Napi::Value Destroy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        return env.Undefined();
    }

    uint64_t handle = (uint64_t)info[0].As<Napi::Number>().Int64Value();

    std::lock_guard<std::mutex> lock(g_mutex);

    auto it = g_instances.find(handle);
    if (it == g_instances.end()) {
        return env.Undefined();
    }

    [it->second->capture stop];

    if (it->second->callbackSet) {
        it->second->tsfn.Release();
    }

    g_instances.erase(it);

    return env.Undefined();
}

/**
 * Check if currently capturing.
 *
 * @param handle number
 * @returns boolean
 */
Napi::Value IsCapturing(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        return Napi::Boolean::New(env, false);
    }

    uint64_t handle = (uint64_t)info[0].As<Napi::Number>().Int64Value();

    std::lock_guard<std::mutex> lock(g_mutex);

    auto it = g_instances.find(handle);
    if (it == g_instances.end()) {
        return Napi::Boolean::New(env, false);
    }

    return Napi::Boolean::New(env, it->second->capture.isCapturing);
}

/**
 * Check if this platform is supported.
 *
 * @returns boolean
 */
Napi::Value IsSupported(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Check macOS 13.0+
    if (@available(macOS 13.0, *)) {
        return Napi::Boolean::New(env, true);
    }
    return Napi::Boolean::New(env, false);
}

/**
 * Module initialization.
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("create", Napi::Function::New(env, Create));
    exports.Set("setCallback", Napi::Function::New(env, SetCallback));
    exports.Set("start", Napi::Function::New(env, Start));
    exports.Set("stop", Napi::Function::New(env, Stop));
    exports.Set("destroy", Napi::Function::New(env, Destroy));
    exports.Set("isCapturing", Napi::Function::New(env, IsCapturing));
    exports.Set("isSupported", Napi::Function::New(env, IsSupported));

    return exports;
}

NODE_API_MODULE(kakarot_audio, Init)

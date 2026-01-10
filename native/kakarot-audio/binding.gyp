{
  "targets": [
    {
      "target_name": "kakarot_audio",
      "sources": [
        "src/addon.mm",
        "src/CombinedAudioCapture.mm",
        "src/MicrophoneCapture.mm",
        "src/SystemAudioCapture.mm",
        "src/AudioSyncBuffer.cpp",
        "src/WebRtcAEC.cpp",
        "src/WebRtcAECWrapper.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src",
        "deps/webrtc-audio-processing/webrtc",
        "deps/webrtc-2.0-install/include"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "WEBRTC_POSIX",
        "WEBRTC_MAC",
        "WEBRTC_LIBRARY_IMPL"
      ],
      "conditions": [
        ["OS=='mac'", {
          "libraries": [
            "../deps/webrtc-2.0-install/lib/libwebrtc-audio-processing-2.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_base.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_strings.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_synchronization.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_time.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_types.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_flags.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_hash.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_container.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_debugging.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_numeric.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_profiling.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_random.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_status.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_log.a",
            "../deps/webrtc-audio-processing/build/subprojects/abseil-cpp-20240722.0/libabsl_crc.a"
          ],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "13.0",
            "OTHER_CFLAGS": [
              "-fobjc-arc",
              "-fmodules"
            ],
            "OTHER_LDFLAGS": [
              "-framework CoreAudio",
              "-framework AudioToolbox",
              "-framework AVFoundation",
              "-framework ScreenCaptureKit",
              "-framework CoreMedia",
              "-framework Accelerate",
              "-framework CoreFoundation",
              "-framework Foundation"
            ]
          }
        }]
      ]
    }
  ]
}

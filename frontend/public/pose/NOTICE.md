# Local pose assets

MediaPipe Tasks Vision 1.2.2: `wasm/vision_wasm_module_internal.js` and `.wasm`, copied unchanged from the pinned `@mediapipe/tasks-vision` npm package. Source and licensing: https://github.com/google-ai-edge/mediapipe (Apache-2.0).

Pose Landmarker Lite float16 model, version 1, downloaded from the official model distribution:
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

Model SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
Runtime WASM SHA-256: `b8927a2eebfe80dd98a426a210a9e820c8215168c06f3bcf5d4d09080f623db5`.

These public assets load from the application's own origin only when analyzing a new photo. The worker is terminated after analysis; landmarks are discarded. Photographs are never sent to MediaPipe/Google.

import { useState, useRef, useCallback } from "react";
import { checkMediaCapability, isWeChatBrowser } from "@/utils/platform";

export interface CapturedMedia {
  type: "image" | "video";
  data: string;
  blob?: Blob;
  name: string;
}

export const useCamera = () => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const cameraErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [recordingTime, setRecordingTime] = useState(0);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 辅助函数：设置带超时的错误信息（必须在其他函数之前定义）
  const setCameraErrorWithTimeout = useCallback((message: string, durationMs = 6000) => {
    if (cameraErrorTimer.current) {
      clearTimeout(cameraErrorTimer.current);
    }
    setCameraError(message);
    cameraErrorTimer.current = setTimeout(() => {
      setCameraError("");
    }, durationMs);
  }, []);

  // 辅助函数：同时设置支持状态和错误信息
  const setCameraSupportedAndError = useCallback(
    (supported: boolean, message: string) => {
      setIsCameraSupported(supported);
      setCameraErrorWithTimeout(message, 7000);
    },
    [setCameraErrorWithTimeout]
  );

  const initializeCamera = useCallback(async () => {
    // 使用平台检测工具检查媒体功能可用性
    const mediaCheck = checkMediaCapability();
    if (!mediaCheck.supported) {
      const isZh = typeof navigator !== "undefined" && navigator.language?.startsWith("zh");
      const errorMsg = isZh
        ? `摄像头不可用：${mediaCheck.reason}`
        : `Camera unavailable: ${mediaCheck.reason}`;
      setCameraSupportedAndError(false, errorMsg);
      return null;
    }

    // 微信浏览器特殊提示
    if (isWeChatBrowser()) {
      const isZh = typeof navigator !== "undefined" && navigator.language?.startsWith("zh");
      console.log(isZh ? "[Camera] 检测到微信浏览器环境" : "[Camera] WeChat browser detected");
    }

    // Guard: browser + secure context required
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setCameraSupportedAndError(false, "Camera is not available in this environment.");
      return null;
    }
    if (
      location.protocol !== "https:" &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {
      setCameraSupportedAndError(false, "Camera access requires HTTPS or localhost.");
      return null;
    }

    // Check camera permission state if available
    if (navigator.permissions?.query) {
      try {
        const cameraPermission: PermissionStatus = await navigator.permissions.query({
          // @ts-ignore: older TS lib misses "camera"
          name: "camera",
        });
        if (cameraPermission.state === "denied") {
          setCameraErrorWithTimeout(
            "Camera permission is blocked in the browser. Please allow camera access in site settings."
          );
          return null;
        }
      } catch {
        // ignore permissions API errors; proceed to getUserMedia
      }
    }

    // Stop any existing tracks before requesting a new stream
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }

    setCameraError("");

    // Prefer to request video first; add audio only if actually needed for recording
    const wantsAudio = cameraMode === "video";
    const audioConstraint = wantsAudio
      ? { echoCancellation: true, noiseSuppression: true }
      : false;

    // Try a sequence of constraints to maximize success.
    // Order: video-only first (avoids NotFound when no mic), then video+audio.
    const constraintsList: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: { facingMode: { ideal: "user" } }, audio: false },
      { video: true, audio: false },
      { video: { facingMode: { ideal: "environment" } }, audio: audioConstraint },
      { video: { facingMode: { ideal: "user" } }, audio: audioConstraint },
      { video: true, audio: audioConstraint },
    ];

    for (let i = 0; i < constraintsList.length; i++) {
      const constraints = constraintsList[i];
      const isLast = i === constraintsList.length - 1;
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setCameraStream(stream);
        setIsCameraActive(true);
        return stream;
      } catch (err: any) {
        console.warn("getUserMedia failed with constraints", constraints, err);
        const isAudioRequested =
          constraints.audio === true ||
          (typeof constraints.audio === "object" && constraints.audio !== null);
        // If NotFoundError happened while requesting audio, try next fallback (likely audio-less)
        if (err?.name === "NotFoundError" && isAudioRequested && !isLast) {
          continue;
        }
        if (isLast) {
          const message =
            err?.name === "NotAllowedError"
              ? "Camera permission was denied. Please allow camera access in your browser."
              : err?.name === "NotFoundError"
              ? "Camera is unavailable. Please check that a camera is connected and allowed, then retry."
              : err?.message
              ? `Failed to access camera: ${err.message}`
              : "Failed to access camera. Please check permissions and device availability.";
          setCameraErrorWithTimeout(message, 7000);
        }
      }
    }

    return null;
  }, [cameraMode, cameraStream]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
      setIsVideoRecording(false);
      setRecordingTime(0);
    }
    setCameraError("");
  }, [cameraStream]);

  const toggleCamera = useCallback(async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      await initializeCamera();
    }
  }, [isCameraActive, stopCamera, initializeCamera]);

  const capturePhoto = useCallback(async (): Promise<CapturedMedia | null> => {
    if (!cameraStream) return null;

    setIsCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      const video = document.createElement("video");

      video.srcObject = cameraStream;
      await video.play();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `photo-${timestamp}.jpg`;

        // Convert data URL to Blob
        const response = await fetch(imageData);
        const blob = await response.blob();

        const media: CapturedMedia = {
          type: "image",
          data: imageData,
          blob,
          name: fileName,
        };

        setCapturedMedia(media);
        return media;
      }
      return null;
    } catch (error) {
      console.warn("[Camera] Photo capture error:", error);
      setCameraErrorWithTimeout("拍照失败", 5000);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [cameraStream, setCameraErrorWithTimeout]);

  const startVideoRecording = useCallback(async () => {
    if (!cameraStream) return;

    try {
      videoChunksRef.current = [];

      // 只支持 mp4 格式（Safari 支持）
      // Chrome/Firefox 录制的 webm 格式与 Qwen API 不兼容
      const mimeType = MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "";

      if (!mimeType) {
        setCameraErrorWithTimeout(
          "当前浏览器不支持视频录制，请使用 Safari 浏览器或从相册选择 mp4 视频",
          7000
        );
        return;
      }

      const mediaRecorder = new MediaRecorder(cameraStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      setIsVideoRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.warn("[Camera] Video recording error:", error);
      setCameraErrorWithTimeout("无法开始视频录制", 5000);
      setIsVideoRecording(false);
    }
  }, [cameraStream, setCameraErrorWithTimeout]);

  const stopVideoRecording = useCallback((): Promise<CapturedMedia | null> => {
    return new Promise((resolve) => {
      // 清理计时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // 检查 MediaRecorder 状态
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        setIsVideoRecording(false);
        setRecordingTime(0);
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;

      // 设置 onstop 回调处理录制完成
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(videoChunksRef.current, { type: mimeType });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        // 直接使用原始格式，服务器端会处理 webm 到 mp4 的转换
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const name = `video-${timestamp}.${ext}`;
        const url = URL.createObjectURL(blob);
        const media: CapturedMedia = { type: "video", data: url, blob, name };
        setCapturedMedia(media);
        setIsVideoRecording(false);
        setRecordingTime(0);
        resolve(media);
      };

      // 设置错误处理
      recorder.onerror = (event) => {
        console.warn("[Camera] MediaRecorder error:", event);
        setCameraErrorWithTimeout("视频录制出错，请重试", 5000);
        setIsVideoRecording(false);
        setRecordingTime(0);
        resolve(null);
      };

      // 停止录制
      try {
        recorder.stop();
      } catch (err) {
        console.warn("[Camera] Failed to stop recorder:", err);
        setIsVideoRecording(false);
        setRecordingTime(0);
        resolve(null);
      }
    });
  }, [setCameraErrorWithTimeout]);

  const toggleVideoRecording = useCallback(async () => {
    if (isVideoRecording) {
      return await stopVideoRecording();
    } else {
      await startVideoRecording();
      return null;
    }
  }, [isVideoRecording, startVideoRecording, stopVideoRecording]);

  const formatRecordingTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const switchCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === "photo" ? "video" : "photo"));
  }, []);

  return {
    isCameraActive,
    cameraStream,
    cameraError,
    isCameraSupported,
    capturedMedia,
    setCapturedMedia,
    isCapturing,
    cameraMode,
    recordingTime,
    isVideoRecording,
    isConverting,
    convertProgress,
    initializeCamera,
    stopCamera,
    toggleCamera,
    capturePhoto,
    startVideoRecording,
    stopVideoRecording,
    toggleVideoRecording,
    formatRecordingTime,
    switchCameraMode,
  };
};

import { useState, useRef, useCallback } from "react";

export const useCamera = () => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const cameraErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<{
    type: "image" | "video";
    data: string;
    name: string;
  } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [recordingTime, setRecordingTime] = useState(0);
  const [isVideoRecording, setIsVideoRecording] = useState(false);

  const initializeCamera = useCallback(async () => {
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

  const capturePhoto = useCallback(async () => {
    if (!cameraStream) return;

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

        setCapturedMedia({
          type: "image",
          data: imageData,
          name: fileName,
        });
      }
    } catch (error) {
      console.error("Photo capture error:", error);
      setCameraErrorWithTimeout("Failed to capture photo", 5000);
    } finally {
      setIsCapturing(false);
    }
  }, [cameraStream]);

  const startVideoRecording = useCallback(async () => {
    if (!cameraStream) return;

    try {
      setIsVideoRecording(true);
      setRecordingTime(0);

      // Start recording timer
      const timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Store timer reference for cleanup
      (window as any).recordingTimer = timer;
    } catch (error) {
      console.error("Video recording error:", error);
      setCameraErrorWithTimeout("Failed to start video recording", 5000);
      setIsVideoRecording(false);
    }
  }, [cameraStream]);

  const stopVideoRecording = useCallback(async () => {
    if (!cameraStream) return;

    try {
      setIsVideoRecording(false);

      // Clear timer
      if ((window as any).recordingTimer) {
        clearInterval((window as any).recordingTimer);
      }

      // For now, we'll simulate video capture
      // In a real implementation, you'd use MediaRecorder API
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `video-${timestamp}.mp4`;

      setCapturedMedia({
        type: "video",
        data: `data:video/mp4;base64,simulated-video-data`, // Placeholder
        name: fileName,
      });
    } catch (error) {
      console.error("Video recording stop error:", error);
      setCameraErrorWithTimeout("Failed to stop video recording", 5000);
    }
  }, [cameraStream]);

  const toggleVideoRecording = useCallback(() => {
    if (isVideoRecording) {
      stopVideoRecording();
    } else {
      startVideoRecording();
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

  const setCameraErrorWithTimeout = useCallback((message: string, durationMs = 6000) => {
    if (cameraErrorTimer.current) {
      clearTimeout(cameraErrorTimer.current);
    }
    setCameraError(message);
    cameraErrorTimer.current = setTimeout(() => {
      setCameraError("");
    }, durationMs);
  }, []);

  // Helper to update support flag and error together
  const setCameraSupportedAndError = useCallback(
    (supported: boolean, message: string) => {
      setIsCameraSupported(supported);
      setCameraErrorWithTimeout(message, 7000);
    },
    [setCameraErrorWithTimeout]
  );

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

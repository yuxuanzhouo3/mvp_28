import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CapturedMedia } from "@/hooks/useCamera";

interface CameraPanelProps {
  isCameraActive: boolean;
  cameraStream: MediaStream | null;
  isVideoRecording: boolean;
  recordingTime: number;
  cameraMode: "photo" | "video";
  isCapturing: boolean;
  isConverting?: boolean;
  convertProgress?: number;
  switchCameraMode: () => void;
  capturePhoto: () => Promise<CapturedMedia | null>;
  toggleVideoRecording: () => Promise<CapturedMedia | null>;
  stopCamera: () => void;
  formatRecordingTime: (time: number) => string;
  onMediaCaptured?: (media: CapturedMedia) => void;
  selectedLanguage?: string;
}

export function CameraPanel({
  isCameraActive,
  cameraStream,
  isVideoRecording,
  recordingTime,
  cameraMode,
  isCapturing,
  isConverting = false,
  convertProgress = 0,
  switchCameraMode,
  capturePhoto,
  toggleVideoRecording,
  stopCamera,
  formatRecordingTime,
  onMediaCaptured,
  selectedLanguage = "zh",
}: CameraPanelProps) {
  const [previewMedia, setPreviewMedia] = useState<CapturedMedia | null>(null);

  if (!isCameraActive) return null;

  const isZh = selectedLanguage === "zh";

  const handleCapturePhoto = async () => {
    const media = await capturePhoto();
    if (media) {
      setPreviewMedia(media);
    }
  };

  const handleToggleVideoRecording = async () => {
    const media = await toggleVideoRecording();
    if (media) {
      setPreviewMedia(media);
    }
  };

  const handleConfirm = () => {
    if (!previewMedia || !onMediaCaptured) return;

    onMediaCaptured(previewMedia);
    setPreviewMedia(null);
    stopCamera();
  };

  const handleRetake = () => {
    setPreviewMedia(null);
  };

  const handleClose = () => {
    setPreviewMedia(null);
    stopCamera();
  };

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-[#565869] dark:bg-[#565869]">
      <div className="space-y-3">
        {previewMedia ? (
          <>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {previewMedia.type === "image" ? (
                <img
                  src={previewMedia.data}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  key={previewMedia.data}
                  src={previewMedia.data}
                  className="h-full w-full object-cover"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                />
              )}
              <div className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
                {previewMedia.type === "image"
                  ? isZh
                    ? "📷 照片预览"
                    : "📷 Photo Preview"
                  : isZh
                    ? "🎬 视频预览"
                    : "🎬 Video Preview"}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetake}
                className="text-xs"
              >
                {isZh ? "重新拍摄" : "Retake"}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {isZh ? "立即上传" : "Upload Now"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClose}
                className="text-xs text-red-500 hover:text-red-700"
              >
                {isZh ? "取消" : "Cancel"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {cameraStream && (
                <video
                  ref={(video) => {
                    if (video && cameraStream) {
                      video.srcObject = cameraStream;
                      video.play().catch(() => {});
                    }
                  }}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              )}

              {isVideoRecording && (
                <div className="absolute left-2 top-2 flex items-center space-x-2 rounded bg-red-600 px-2 py-1 text-xs text-white">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span>{formatRecordingTime(recordingTime)}</span>
                </div>
              )}

              {isConverting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                  <div className="mb-2 text-sm text-white">
                    {isZh ? "正在转换视频格式..." : "Converting video..."}
                  </div>
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-700">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${convertProgress}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-white">{convertProgress}%</div>
                </div>
              )}

              <div className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
                {cameraMode === "photo"
                  ? isZh
                    ? "📷 拍照"
                    : "📷 Photo"
                  : isZh
                    ? "🎬 录像"
                    : "🎬 Video"}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4">
              <Button
                size="sm"
                variant="outline"
                onClick={switchCameraMode}
                className="text-xs"
                disabled={isVideoRecording}
              >
                {cameraMode === "photo"
                  ? isZh
                    ? "切换到录像"
                    : "Switch to Video"
                  : isZh
                    ? "切换到拍照"
                    : "Switch to Photo"}
              </Button>

              {cameraMode === "photo" ? (
                <Button
                  size="sm"
                  onClick={handleCapturePhoto}
                  disabled={isCapturing}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isCapturing
                    ? isZh
                      ? "拍摄中..."
                      : "Capturing..."
                    : isZh
                      ? "拍照"
                      : "Take Photo"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleToggleVideoRecording}
                  className={`${
                    isVideoRecording
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  {isVideoRecording
                    ? isZh
                      ? "停止录制"
                      : "Stop Recording"
                    : isZh
                      ? "开始录制"
                      : "Start Recording"}
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleClose}
                className="text-xs"
              >
                {isZh ? "关闭" : "Close"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

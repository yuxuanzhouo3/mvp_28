import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CapturedMedia } from "@/hooks/useCamera";
import { IS_DOMESTIC_VERSION } from "@/config";

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
  onFeatureInDev?: () => void;
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
  onFeatureInDev,
  selectedLanguage = "zh",
}: CameraPanelProps) {
  // 本地预览状态
  const [previewMedia, setPreviewMedia] = useState<CapturedMedia | null>(null);

  if (!isCameraActive) return null;

  const isZh = selectedLanguage === "zh";

  // 拍照 - 保存到预览状态
  const handleCapturePhoto = async () => {
    const media = await capturePhoto();
    if (media) {
      setPreviewMedia(media);
    }
  };

  // 录像 - 停止后保存到预览状态
  const handleToggleVideoRecording = async () => {
    const media = await toggleVideoRecording();
    if (media) {
      setPreviewMedia(media);
    }
  };

  // 确认上传
  const handleConfirm = () => {
    if (!previewMedia) return;

    // 国际版：拦截并提示功能开发中
    if (!IS_DOMESTIC_VERSION) {
      onFeatureInDev?.();
      return;
    }

    if (onMediaCaptured) {
      onMediaCaptured(previewMedia);
      setPreviewMedia(null);
      stopCamera();
    }
  };

  // 重新拍摄
  const handleRetake = () => {
    setPreviewMedia(null);
  };

  // 关闭相机
  const handleClose = () => {
    setPreviewMedia(null);
    stopCamera();
  };

  return (
    <div className="mt-2 p-4 bg-gray-50 dark:bg-[#565869] border border-gray-200 dark:border-[#565869] rounded-md">
      <div className="space-y-3">
        {/* 预览模式 */}
        {previewMedia ? (
          <>
            {/* 预览区域 */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              {previewMedia.type === "image" ? (
                <img
                  src={previewMedia.data}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  key={previewMedia.data}
                  src={previewMedia.data}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                />
              )}
              {/* 预览标签 */}
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                {previewMedia.type === "image"
                  ? (isZh ? "📷 照片预览" : "📷 Photo Preview")
                  : (isZh ? "🎥 视频预览" : "🎥 Video Preview")}
              </div>
            </div>

            {/* 预览操作按钮 */}
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
                className="bg-green-600 hover:bg-green-700 text-white"
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
            {/* 相机实时预览 */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              {cameraStream && (
                <video
                  ref={(video) => {
                    if (video && cameraStream) {
                      video.srcObject = cameraStream;
                      video.play().catch(() => {});
                    }
                  }}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              )}

              {/* 录制指示器 */}
              {isVideoRecording && (
                <div className="absolute top-2 left-2 flex items-center space-x-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>{formatRecordingTime(recordingTime)}</span>
                </div>
              )}

              {/* 转换进度指示器 */}
              {isConverting && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                  <div className="text-white text-sm mb-2">
                    {isZh ? "正在转换视频格式..." : "Converting video..."}
                  </div>
                  <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${convertProgress}%` }}
                    />
                  </div>
                  <div className="text-white text-xs mt-1">{convertProgress}%</div>
                </div>
              )}

              {/* 模式指示器 */}
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                {cameraMode === "photo"
                  ? (isZh ? "📷 拍照" : "📷 Photo")
                  : (isZh ? "🎥 录像" : "🎥 Video")}
              </div>
            </div>

            {/* 相机控制按钮 */}
            <div className="flex items-center justify-center space-x-4">
              {/* 模式切换 */}
              <Button
                size="sm"
                variant="outline"
                onClick={switchCameraMode}
                className="text-xs"
                disabled={isVideoRecording}
              >
                {cameraMode === "photo"
                  ? (isZh ? "切换到录像" : "Switch to Video")
                  : (isZh ? "切换到拍照" : "Switch to Photo")}
              </Button>

              {/* 拍摄按钮 */}
              {cameraMode === "photo" ? (
                <Button
                  size="sm"
                  onClick={handleCapturePhoto}
                  disabled={isCapturing}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isCapturing
                    ? (isZh ? "拍摄中..." : "Capturing...")
                    : (isZh ? "拍照" : "Take Photo")}
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
                    ? (isZh ? "停止录制" : "Stop Recording")
                    : (isZh ? "开始录制" : "Start Recording")}
                </Button>
              )}

              {/* 关闭相机 */}
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

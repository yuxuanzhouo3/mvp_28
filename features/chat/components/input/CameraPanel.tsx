import React from "react";
import { Button } from "@/components/ui/button";
import { CapturedMediaPreview } from "./CapturedMediaPreview";

interface CameraPanelProps {
  isCameraActive: boolean;
  cameraStream: MediaStream | null;
  isVideoRecording: boolean;
  recordingTime: number;
  cameraMode: "photo" | "video";
  isCapturing: boolean;
  capturedMedia: { type: "image" | "video"; data: string; name?: string } | null;
  switchCameraMode: () => void;
  capturePhoto: () => void;
  toggleVideoRecording: () => void;
  stopCamera: () => void;
  formatRecordingTime: (time: number) => string;
}

export function CameraPanel({
  isCameraActive,
  cameraStream,
  isVideoRecording,
  recordingTime,
  cameraMode,
  isCapturing,
  capturedMedia,
  switchCameraMode,
  capturePhoto,
  toggleVideoRecording,
  stopCamera,
  formatRecordingTime,
}: CameraPanelProps) {
  if (!isCameraActive) return null;

  return (
    <div className="mt-2 p-4 bg-gray-50 dark:bg-[#565869] border border-gray-200 dark:border-[#565869] rounded-md">
      <div className="space-y-3">
        {/* Camera Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {cameraStream && (
            <video
              ref={(video) => {
                if (video && cameraStream) {
                  video.srcObject = cameraStream;
                  video.play();
                }
              }}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
          )}

          {/* Recording Indicator */}
          {isVideoRecording && (
            <div className="absolute top-2 left-2 flex items-center space-x-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>{formatRecordingTime(recordingTime)}</span>
            </div>
          )}

          {/* Mode Indicator */}
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
            {cameraMode === "photo" ? "📷 Photo" : "🎥 Video"}
          </div>
        </div>

        {/* Camera Controls */}
        <div className="flex items-center justify-center space-x-4">
          {/* Mode Switch */}
          <Button
            size="sm"
            variant="outline"
            onClick={switchCameraMode}
            className="text-xs"
          >
            {cameraMode === "photo" ? "Switch to Video" : "Switch to Photo"}
          </Button>

          {/* Capture Button */}
          {cameraMode === "photo" ? (
            <Button
              size="sm"
              onClick={capturePhoto}
              disabled={isCapturing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCapturing ? "Capturing..." : "Take Photo"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={toggleVideoRecording}
              className={`${
                isVideoRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              {isVideoRecording ? "Stop Recording" : "Start Recording"}
            </Button>
          )}

          {/* Close Camera */}
          <Button
            size="sm"
            variant="outline"
            onClick={stopCamera}
            className="text-xs"
          >
            Close
          </Button>
        </div>

        <CapturedMediaPreview capturedMedia={capturedMedia} />
      </div>
    </div>
  );
}

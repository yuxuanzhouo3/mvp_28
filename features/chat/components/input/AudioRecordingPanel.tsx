import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { IS_DOMESTIC_VERSION } from "@/config";
import { AudioPlayer } from "@/components/AudioPlayer";

interface AudioRecordingResult {
  blob: Blob;
  url: string;
  name: string;
}

interface AudioRecordingPanelProps {
  isActive: boolean;
  onClose: () => void;
  onUpload: (result: AudioRecordingResult) => void;
  onFeatureInDev?: () => void;
  selectedLanguage?: string;
}

export function AudioRecordingPanel({
  isActive,
  onClose,
  onUpload,
  onFeatureInDev,
  selectedLanguage = "zh",
}: AudioRecordingPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewAudio, setPreviewAudio] = useState<AudioRecordingResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isZh = selectedLanguage === "zh";

  // 清理资源
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (previewAudio?.url) {
        URL.revokeObjectURL(previewAudio.url);
      }
    };
  }, []);

  // 格式化录音时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  // 停止录音并生成预览
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      setIsRecording(false);
      return;
    }

    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const ext = mimeType.includes("webm") ? "webm" : "m4a";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const name = `audio-${timestamp}.${ext}`;
      const url = URL.createObjectURL(blob);

      setPreviewAudio({ blob, url, name });
      setIsRecording(false);

      // 停止麦克风
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    mediaRecorderRef.current.stop();
  };

  // 确认上传
  const handleConfirm = () => {
    if (!previewAudio) return;

    // 国际版：拦截并提示功能开发中
    if (!IS_DOMESTIC_VERSION) {
      onFeatureInDev?.();
      return;
    }

    onUpload(previewAudio);
    handleClose();
  };

  // 重新录制
  const handleRetake = () => {
    if (previewAudio?.url) {
      URL.revokeObjectURL(previewAudio.url);
    }
    setPreviewAudio(null);
    setRecordingTime(0);
  };

  // 关闭面板
  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (previewAudio?.url) {
      URL.revokeObjectURL(previewAudio.url);
    }
    setIsRecording(false);
    setPreviewAudio(null);
    setRecordingTime(0);
    onClose();
  };

  if (!isActive) return null;

  return (
    <div className="mt-2 p-4 bg-gray-50 dark:bg-[#565869] border border-gray-200 dark:border-[#565869] rounded-md">
      <div className="space-y-3">
        {/* 预览模式 */}
        {previewAudio ? (
          <>
            {/* 音频预览区域 */}
            <div className="relative bg-gray-100 dark:bg-[#40414f] rounded-lg p-4">
              <div className="flex items-center justify-center mb-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isZh ? "🎙️ 录音预览" : "🎙️ Audio Preview"}
                </div>
              </div>
              <AudioPlayer src={previewAudio.url} className="w-full" />
              <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                {previewAudio.name}
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
                {isZh ? "重新录制" : "Re-record"}
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
            {/* 录音界面 */}
            <div className="relative bg-gray-100 dark:bg-[#40414f] rounded-lg p-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                {/* 录音状态指示 */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isRecording
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-gray-200 dark:bg-[#565869]"
                }`}>
                  {isRecording ? (
                    <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse" />
                  ) : (
                    <Mic className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                  )}
                </div>

                {/* 录音时间 */}
                <div className={`text-2xl font-mono ${
                  isRecording ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
                }`}>
                  {formatTime(recordingTime)}
                </div>

                {/* 状态文字 */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isRecording
                    ? (isZh ? "正在录音..." : "Recording...")
                    : (isZh ? "点击开始录音" : "Click to start recording")}
                </div>
              </div>
            </div>

            {/* 录音控制按钮 */}
            <div className="flex items-center justify-center space-x-4">
              {isRecording ? (
                <Button
                  size="sm"
                  onClick={stopRecording}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Square className="w-4 h-4 mr-2" />
                  {isZh ? "停止录音" : "Stop Recording"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={startRecording}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  {isZh ? "开始录音" : "Start Recording"}
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

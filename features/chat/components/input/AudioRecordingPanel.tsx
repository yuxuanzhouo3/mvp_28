import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
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
  selectedLanguage?: string;
}

export function AudioRecordingPanel({
  isActive,
  onClose,
  onUpload,
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewAudio?.url) {
        URL.revokeObjectURL(previewAudio.url);
      }
    };
  }, [previewAudio]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    mediaRecorderRef.current.stop();
  };

  const handleConfirm = () => {
    if (!previewAudio) return;

    onUpload(previewAudio);
    handleClose();
  };

  const handleRetake = () => {
    if (previewAudio?.url) {
      URL.revokeObjectURL(previewAudio.url);
    }
    setPreviewAudio(null);
    setRecordingTime(0);
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
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
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-[#565869] dark:bg-[#565869]">
      <div className="space-y-3">
        {previewAudio ? (
          <>
            <div className="relative rounded-lg bg-gray-100 p-4 dark:bg-[#40414f]">
              <div className="mb-3 flex items-center justify-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isZh ? "🎙️ 录音预览" : "🎙️ Audio Preview"}
                </div>
              </div>
              <AudioPlayer src={previewAudio.url} className="w-full" />
              <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                {previewAudio.name}
              </div>
            </div>

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
            <div className="relative rounded-lg bg-gray-100 p-6 dark:bg-[#40414f]">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full ${
                    isRecording
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-gray-200 dark:bg-[#565869]"
                  }`}
                >
                  {isRecording ? (
                    <div className="h-4 w-4 animate-pulse rounded-full bg-red-600" />
                  ) : (
                    <Mic className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                  )}
                </div>

                <div
                  className={`text-2xl font-mono ${
                    isRecording
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {formatTime(recordingTime)}
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {isRecording
                    ? isZh
                      ? "正在录音..."
                      : "Recording..."
                    : isZh
                      ? "点击开始录音"
                      : "Click to start recording"}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4">
              {isRecording ? (
                <Button
                  size="sm"
                  onClick={stopRecording}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  <Square className="mr-2 h-4 w-4" />
                  {isZh ? "停止录音" : "Stop Recording"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={startRecording}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Mic className="mr-2 h-4 w-4" />
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

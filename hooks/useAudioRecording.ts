import { useState, useRef, useCallback } from "react";

export interface AudioRecordingResult {
  blob: Blob;
  url: string;
  name: string;
}

export const useAudioRecording = () => {
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [audioRecordingTime, setAudioRecordingTime] = useState(0);
  const [audioError, setAudioError] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startAudioRecording = useCallback(
    async (onComplete: (result: AudioRecordingResult) => void) => {
      try {
        setAudioError("");
        audioChunksRef.current = [];

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4",
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType,
          });
          const ext = mediaRecorder.mimeType.includes("webm") ? "webm" : "m4a";
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const name = `audio-${timestamp}.${ext}`;
          const url = URL.createObjectURL(blob);

          onComplete({ blob, url, name });

          // Cleanup
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        };

        mediaRecorder.start(1000);
        setIsAudioRecording(true);
        setAudioRecordingTime(0);

        timerRef.current = setInterval(() => {
          setAudioRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        const message =
          err?.name === "NotAllowedError"
            ? "麦克风权限被拒绝，请在浏览器设置中允许麦克风访问"
            : "无法访问麦克风，请检查设备连接";
        setAudioError(message);
        setTimeout(() => setAudioError(""), 5000);
      }
    },
    []
  );

  const stopAudioRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsAudioRecording(false);
    setAudioRecordingTime(0);
  }, []);

  const formatRecordingTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    isAudioRecording,
    audioRecordingTime,
    audioError,
    startAudioRecording,
    stopAudioRecording,
    formatRecordingTime,
  };
};

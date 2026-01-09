"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Loader2 } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 重置状态
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoading(true);

    const updateDuration = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      updateDuration();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      updateDuration();
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("canplaythrough", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    // 强制加载音频以获取时长
    audio.load();

    return () => {
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("canplaythrough", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * duration;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-2 bg-gray-100 dark:bg-[#40414f] rounded-lg px-3 py-2 ${className}`}>
      <audio ref={audioRef} src={src} preload="auto" />

      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white transition-colors flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right flex-shrink-0">
          {formatTime(currentTime)}
        </span>

        <div
          className="flex-1 relative h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 flex-shrink-0">
          {duration > 0 ? formatTime(duration) : (isLoading ? "..." : "0:00")}
        </span>
      </div>

      <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </div>
  );
}

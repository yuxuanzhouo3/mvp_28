"use client";

import React from "react";
import { Video } from "lucide-react";

interface CapturedMediaPreviewProps {
  capturedMedia: { type: "image" | "video"; data: string; name?: string } | null;
}

export function CapturedMediaPreview({ capturedMedia }: CapturedMediaPreviewProps) {
  if (!capturedMedia) return null;

  return (
    <div className="p-2 bg-white dark:bg-[#40414f] border border-gray-200 dark:border-[#565869] rounded">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        {capturedMedia.type === "image" ? "📸 Captured Photo:" : "🎥 Recorded Video:"}{" "}
        {capturedMedia.name}
      </p>

      {capturedMedia.type === "image" ? (
        <img
          src={capturedMedia.data}
          alt="Captured"
          className="w-full h-32 object-cover rounded"
        />
      ) : (
        <div className="w-full h-32 bg-gray-100 dark:bg-[#565869] rounded flex items-center justify-center">
          <Video className="w-8 h-8 text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Video Preview</span>
        </div>
      )}
    </div>
  );
}

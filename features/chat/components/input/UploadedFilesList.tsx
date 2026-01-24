"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X, FileText, Image, Video, Music, File } from "lucide-react";
import type { AttachmentItem } from "@/types";

interface UploadedFilesListProps {
  uploadedFiles: AttachmentItem[];
  maxFiles: number;
  formatFileSize: (bytes: number) => string;
  setUploadedFiles: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  removeFile: (index: number) => void;
  getFileIcon: (type: string) => string;
}

// 根据文件类型获取图标和颜色
function getFileStyle(type: string) {
  if (type.startsWith("image/")) return { icon: Image, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" };
  if (type.startsWith("video/")) return { icon: Video, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" };
  if (type.startsWith("audio/")) return { icon: Music, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-900/20" };
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return { icon: FileText, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" };
  return { icon: File, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-700/30" };
}

export function UploadedFilesList({
  uploadedFiles,
  maxFiles,
  formatFileSize,
  setUploadedFiles,
  removeFile,
  getFileIcon,
}: UploadedFilesListProps) {
  if (uploadedFiles.length === 0) return null;

  const totalSize = uploadedFiles.reduce((total, file) => total + file.size, 0);

  return (
    <div className="mt-3 p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-[#2a2b32] dark:to-[#32333a] rounded-xl border border-gray-200/60 dark:border-[#4a4b52] shadow-sm">
      {/* 头部信息 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {uploadedFiles.length}/{maxFiles}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(totalSize)}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
          onClick={() => setUploadedFiles([])}
        >
          <X className="w-3 h-3 mr-1" />
          清空
        </Button>
      </div>

      {/* 文件列表 */}
      <div className="flex flex-wrap gap-2">
        {uploadedFiles.map((file, index) => {
          const style = getFileStyle(file.type);
          const IconComponent = style.icon;
          const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");

          return (
            <div
              key={file.id}
              className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md ${style.bg} border-gray-200/50 dark:border-[#4a4b52]`}
              title={`${file.name} (${formatFileSize(file.size)})`}
            >
              {/* 缩略图或图标 */}
              {isMedia && file.preview ? (
                <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                  {file.type.startsWith("image/") ? (
                    <img
                      src={file.preview}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <video
                      src={file.preview}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  )}
                </div>
              ) : (
                <div className={`w-8 h-8 rounded flex items-center justify-center ${style.bg}`}>
                  <IconComponent className={`w-4 h-4 ${style.color}`} />
                </div>
              )}

              {/* 文件信息 */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatFileSize(file.size)}
                </span>
              </div>

              {/* 删除按钮 */}
              <Button
                size="sm"
                variant="ghost"
                className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                onClick={() => removeFile(index)}
                title="移除文件"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

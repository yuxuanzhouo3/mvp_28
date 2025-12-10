"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { AttachmentItem } from "@/types";

interface UploadedFilesListProps {
  uploadedFiles: AttachmentItem[];
  maxFiles: number;
  formatFileSize: (bytes: number) => string;
  setUploadedFiles: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
  removeFile: (index: number) => void;
  getFileIcon: (type: string) => string;
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
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {uploadedFiles.length}/{maxFiles} files ({formatFileSize(totalSize)})
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
          onClick={() => setUploadedFiles([])}
        >
          Clear all
        </Button>
      </div>

      <div className="grid grid-cols-10 gap-1 max-h-12 overflow-hidden">
        {uploadedFiles.map((file, index) => (
          <div
            key={file.id}
            className="group relative bg-gray-50 dark:bg-[#565869] border border-gray-200 dark:border-[#565869] rounded px-1 py-0.5 text-xs flex items-center"
            title={`${file.name} (${formatFileSize(file.size)})`}
          >
            <span className="text-xs mr-1">{getFileIcon(file.type)}</span>
            <span className="text-gray-700 dark:text-gray-300 truncate text-xs">
              {file.name.length > 8 ? file.name.substring(0, 6) + ".." : file.name}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-3 w-3 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 absolute -top-1 -right-1"
              onClick={() => removeFile(index)}
              title="Remove file"
            >
              <X className="w-2 h-2" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

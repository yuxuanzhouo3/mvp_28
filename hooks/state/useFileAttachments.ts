import { useState, useRef, useCallback } from "react";
import type { AttachmentItem } from "@/types";

/**
 * Minimal attachment state holder.
 * Uploading logic is handled in the provider; this hook just keeps UI state.
 */
export const useFileAttachments = () => {
  const [uploadedFiles, setUploadedFiles] = useState<AttachmentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeFile = useCallback(
    (index: number) => {
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    },
    []
  );

  return {
    uploadedFiles,
    setUploadedFiles,
    fileInputRef,
    removeFile,
  };
};

import { useState, useRef, useCallback } from "react";

export const useFileAttachments = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const fileArray = Array.from(files);
      setUploadedFiles((prev) => [...prev, ...fileArray]);

      fileArray.forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === "string") {
            setFilePreviews((prev) => [...prev, result]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    uploadedFiles,
    setUploadedFiles,
    filePreviews,
    setFilePreviews,
    fileInputRef,
    handleFileUpload,
    removeFile,
  };
};

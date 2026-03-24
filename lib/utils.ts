import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { externalModels } from "../constants";

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Language detection functions
export const containsChinese = (text: string) => {
  return /[\u4e00-\u9fff]/.test(text);
};

export const detectLanguage = (text: string) => {
  if (containsChinese(text)) {
    return "zh";
  }
  return "en";
};

export const autoDetectLanguage = (
  text: string,
  selectedLanguage: string,
  setSelectedLanguage: (lang: string) => void
) => {
  const detectedLang = detectLanguage(text);
  if (detectedLang !== selectedLanguage) {
    setSelectedLanguage(detectedLang);
  }
  return detectedLang;
};

// File handling functions
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith("image/")) return "[img]";
  if (fileType.startsWith("audio/")) return "[aud]";
  if (fileType.startsWith("video/")) return "[vid]";
  if (fileType.includes("pdf")) return "[pdf]";
  if (fileType.includes("word") || fileType.includes("document")) return "[doc]";
  if (fileType.includes("excel") || fileType.includes("spreadsheet")) return "[xls]";
  if (fileType.startsWith("text/") || fileType.includes("markdown")) return "[txt]";
  if (fileType.includes("json") || fileType.includes("xml")) return "[data]";
  return "[file]";
};

// Clipboard functions
export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Failed to copy text: ", err);
  }
};

export const shareMessage = async (text: string) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "MornGPT Response",
        text: text,
      });
    } catch (err) {
      console.error("Error sharing:", err);
    }
  } else {
    copyToClipboard(text);
  }
};

export const downloadMessage = (text: string, messageId: string) => {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `morngpt-response-${messageId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Model display functions
// Date formatting for chat messages
export const formatMessageDate = (date: Date, lang: string = "zh"): string => {
  const now = new Date();
  const msgDate = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return lang === "zh" ? "今天" : "Today";
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return lang === "zh" ? "昨天" : "Yesterday";
  }

  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays < 7) {
    const weekdays = lang === "zh"
      ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return weekdays[msgDate.getDay()];
  }

  if (msgDate.getFullYear() === now.getFullYear()) {
    return lang === "zh"
      ? `${msgDate.getMonth() + 1}月${msgDate.getDate()}日`
      : msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return lang === "zh"
    ? `${msgDate.getFullYear()}年${msgDate.getMonth() + 1}月${msgDate.getDate()}日`
    : msgDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

export const getSelectedModelDisplay = (
  selectedModelType: string,
  selectedModel: string,
  selectedCategory: string,
  mornGPTCategories: any[]
) => {
  if (selectedModelType === "general") {
    return "General Model";
  }
  // 优先按已选模型名称匹配外部/多模态模型
  if (selectedModel) {
    const model = externalModels.find(
      (m) =>
        m.id.toLowerCase() === selectedModel.toLowerCase() ||
        m.name.toLowerCase() === selectedModel.toLowerCase()
    );
    if (model) return model.name;
  }
  if (selectedModelType === "morngpt" && selectedCategory) {
    const category = mornGPTCategories.find((c) => c.id === selectedCategory);
    return category?.name || "General Model";
  }
  return selectedModel || "General Model";
};

"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export default function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: DeleteAccountDialogProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = (en: string, zh: string) => (isZh ? zh : en);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{tr("Delete Account", "删除账户")}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              <strong>{tr("Warning:", "警告：")}</strong>{" "}
              {tr(
                "This action cannot be undone. All your data, including chats, bookmarks, and settings will be permanently deleted.",
                "此操作无法撤销。您的所有数据（包括聊天、书签和设置）将被永久删除。"
              )}
            </p>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
              {tr("Are you absolutely sure you want to delete your account?", "你确定要删除你的账号吗？")}
            </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
              disabled={loading}
            >
              {tr("Cancel", "取消")}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? tr("Deleting...", "正在删除...")
                : tr("Delete Account", "删除账户")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

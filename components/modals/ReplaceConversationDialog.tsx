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

interface OldestConversation {
  id: string;
  title: string;
  created_at: string;
}

interface ReplaceConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldestConversation?: OldestConversation;
  currentCount: number;
  conversationLimit: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ReplaceConversationDialog({
  open,
  onOpenChange,
  oldestConversation,
  currentCount,
  conversationLimit,
  onCancel,
  onConfirm,
}: ReplaceConversationDialogProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="text-lg">
              {isZh ? "对话数量已达上限" : "Conversation Limit Reached"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {isZh
              ? `Free 用户最多保存 ${conversationLimit} 条对话，当前已有 ${currentCount} 条。继续创建将覆盖最早的对话记录。`
              : `Free users can save up to ${conversationLimit} conversations. You currently have ${currentCount}. Creating a new one will replace the oldest conversation.`}
          </p>

          {oldestConversation && (
            <div className="p-3 bg-gray-100 dark:bg-[#565869] rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {isZh ? "将被覆盖的对话：" : "Conversation to be replaced:"}
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-[#ececf1] truncate">
                {oldestConversation.title || (isZh ? "无标题" : "Untitled")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isZh ? "创建于：" : "Created: "}
                {formatDate(oldestConversation.created_at)}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isZh
              ? "升级到付费套餐可解锁无限对话存储"
              : "Upgrade to a paid plan for unlimited conversation storage"}
          </p>
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
          >
            {isZh ? "取消" : "Cancel"}
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isZh ? "确认覆盖" : "Confirm Replace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

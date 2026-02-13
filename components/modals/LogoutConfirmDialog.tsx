"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <LogOut className="w-5 h-5" />
            <span>{isZh ? "确认退出登录" : "Confirm Sign Out"}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {isZh
              ? "确定要退出登录吗？当前会话将结束。"
              : "Are you sure you want to sign out? Your current session will be ended."}
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
            >
              {isZh ? "取消" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                console.log("🔵 [LogoutConfirmDialog] Sign Out 按钮被点击");
                alert("即将调用 onConfirm 回调"); // 添加 alert 以便在 Android 环境下验证
                onConfirm();
                console.log("🔵 [LogoutConfirmDialog] onConfirm 回调已调用");
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isZh ? "退出登录" : "Sign Out"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

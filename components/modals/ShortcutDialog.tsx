"use client";

import React, { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutDialog({ open, onOpenChange }: ShortcutDialogProps) {
  const [shortcutsEnabled, setShortcutsEnabled] = React.useState(true);
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  const handleSave = () => {
    console.log("Shortcut settings saved:", { shortcutsEnabled });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Zap className="w-5 h-5 text-yellow-600" />
            <span>{tr("Keyboard Shortcuts", "键盘快捷键")}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                  {tr("Send Message", "发送消息")}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tr("Send current message", "发送当前输入内容")}
                </p>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-[#40414f]">
                Ctrl / ⌘ + Enter
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                  {tr("New Chat", "新建对话")}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tr("Start a new conversation", "开始新的对话")}
                </p>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-[#40414f]">
                Ctrl / ⌘ + N
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                  {tr("Toggle Theme", "切换主题")}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tr("Switch between light/dark", "在明亮/暗色模式间切换")}
                </p>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-[#40414f]">
                Ctrl / ⌘ + T
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-gray-700 dark:text-gray-300">
              {tr("Enable Shortcuts", "启用快捷键")}
            </Label>
            <Switch
              checked={shortcutsEnabled}
              onCheckedChange={setShortcutsEnabled}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-300 dark:border-[#565869]"
            >
              {tr("Close", "关闭")}
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700"
            >
              {tr("Save", "保存")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

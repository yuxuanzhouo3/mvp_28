"use client";

import React, { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Keyboard,
  Settings,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  X,
  Navigation,
  Bot,
  MessageSquare,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ShortcutConflict {
  shortcut: string;
  conflictingAction: string;
}

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcutsEnabled: boolean;
  setShortcutsEnabled: (enabled: boolean) => void;
  shortcutConflict: ShortcutConflict | null;
  onShowResetConfirmation: (
    title: string,
    message: string,
    onConfirm: () => void
  ) => void;
  onResetToDefaults: () => void;
  onImportHotkeys: () => void;
  onExportHotkeys: () => void;
  onResetNavigationShortcuts: () => void;
  onResetAIModelShortcuts: () => void;
  onResetPromptsShortcuts: () => void;
  renderShortcutDisplay: (shortcut: any) => React.ReactNode;
}

export default function ShortcutsHelpDialog({
  open,
  onOpenChange,
  shortcutsEnabled,
  setShortcutsEnabled,
  shortcutConflict,
  onShowResetConfirmation,
  onResetToDefaults,
  onImportHotkeys,
  onExportHotkeys,
  onResetNavigationShortcuts,
  onResetAIModelShortcuts,
  onResetPromptsShortcuts,
  renderShortcutDisplay,
}: ShortcutsHelpDialogProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  const navigationShortcuts = [
    {
      action: tr("New Chat", "新建对话"),
      current: "Ctrl/Cmd + K",
      description: tr("Create a new conversation", "创建新对话"),
    },
    {
      action: tr("Search Chats", "搜索对话"),
      current: "Ctrl/Cmd + F",
      description: tr("Focus the search bar", "聚焦搜索栏"),
    },
    {
      action: tr("Toggle Sidebar", "切换侧边栏"),
      current: "Ctrl/Cmd + B",
      description: tr("Show/hide the sidebar", "显示/隐藏侧边栏"),
    },
    {
      action: tr("Settings", "设置"),
      current: "Ctrl/Cmd + S",
      description: tr("Open settings dialog", "打开设置窗口"),
    },
    {
      action: tr("Toggle Theme", "切换主题"),
      current: "Ctrl/Cmd + D",
      description: tr("Switch light/dark mode", "切换明暗模式"),
    },
    {
      action: tr("Ask GPT", "Ask GPT"),
      current: "Ctrl/Cmd + G",
      description: tr("Open Ask GPT dialog", "打开 Ask GPT 弹窗"),
    },
    {
      action: tr("Downloads", "下载中心"),
      current: "Ctrl/Cmd + L",
      description: tr("Open download section", "打开下载面板"),
    },
    {
      action: tr("Hotkeys Menu", "快捷键设置"),
      current: "Ctrl/Cmd + H",
      description: tr("Open hotkeys configuration", "打开快捷键配置"),
    },
    {
      action: tr("Open Billing", "打开订阅"),
      current: "Ctrl/Cmd + Q",
      description: tr("Open billing management", "打开订阅管理"),
    },
    {
      action: tr("Open Privacy", "打开隐私设置"),
      current: "Ctrl/Cmd + Y",
      description: tr("Open privacy settings", "打开隐私设置"),
    },
    {
      action: tr("Close Dialogs", "关闭弹窗"),
      current: "Ctrl/Cmd + I",
      description: tr("Close any open dialog", "关闭所有弹窗"),
    },
  ];

  const modelShortcuts = [
    {
      action: tr("Deep Thinking", "深度思考"),
      current: "Ctrl/Cmd + 1",
      description: tr("Activate deep thinking mode", "开启深度思考模式"),
    },
    {
      action: tr("Creative Ideas", "创意点子"),
      current: "Ctrl/Cmd + 2",
      description: tr("Generate creative ideas", "生成创意点子"),
    },
    {
      action: tr("Analyze", "分析"),
      current: "Ctrl/Cmd + 3",
      description: tr("Provide detailed analysis", "提供详细分析"),
    },
    {
      action: tr("Problem Solve", "问题求解"),
      current: "Ctrl/Cmd + 4",
      description: tr("Step-by-step problem solving", "分步解决问题"),
    },
  ];

  const promptShortcuts = [
    {
      action: tr("Send Prompt", "发送 Prompt"),
      current: "Enter",
      description: tr("Send prompt with Enter key", "按 Enter 发送 Prompt"),
    },
    {
      action: tr("Jump to Last", "跳到最新"),
      current: "Ctrl/Cmd + J",
      description: tr("Scroll to latest prompt", "滚动到最新消息"),
    },
    {
      action: tr("Jump to Top", "跳到顶部"),
      current: "Ctrl/Cmd + T",
      description: tr("Scroll to chat beginning", "滚动到对话开头"),
    },
    {
      action: tr("Upload Files", "上传文件"),
      current: "Ctrl/Cmd + U",
      description: tr("Open file upload dialog", "打开文件上传"),
    },
    {
      action: tr("Voice Input", "语音输入"),
      current: "Ctrl/Cmd + R",
      description: tr("Toggle voice recording", "切换语音录制"),
    },
    {
      action: tr("Camera Input", "摄像头输入"),
      current: "Ctrl/Cmd + C",
      description: tr("Open camera for photos/videos", "打开摄像头拍摄"),
    },
    {
      action: tr("Prompt History", "Prompt 历史"),
      current: "Ctrl/Cmd + P",
      description: tr("Open recent prompts", "打开最近的 Prompt"),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-7xl bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Keyboard className="w-4 h-4 text-blue-500" />
            <span className="text-lg">
              {tr("Customize Hotkeys", "自定义快捷键")}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {tr(
              "Configure your keyboard shortcuts for maximum productivity. Use Cmd on Mac, Ctrl on Windows/Linux.",
              "配置键盘快捷键以提升效率。Mac 使用 Cmd，Windows/Linux 使用 Ctrl。"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
          {/* 全局设置 */}
          <div className="p-3 bg-gray-50 dark:bg-[#565869] rounded-lg border border-gray-200 dark:border-[#565869]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 flex-shrink-0">
                  <Settings className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1]">
                    {tr("Global Settings", "全局设置")}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                    {tr("Manage shortcuts and preferences", "管理快捷键与偏好")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-1.5 sm:px-2 py-1 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer h-7"
                  onClick={() =>
                    onShowResetConfirmation(
                      tr("Reset All Hotkeys", "重置全部快捷键"),
                      tr(
                        "Are you sure you want to reset ALL hotkeys to their default values? This action cannot be undone.",
                        "确定要将所有快捷键重置为默认值吗？该操作不可撤销。"
                      ),
                      onResetToDefaults
                    )
                  }
                >
                  <RefreshCw className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr("Reset", "重置")}
                  </span>
                </div>
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-1.5 sm:px-2 py-1 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer h-7"
                  onClick={onImportHotkeys}
                >
                  <Upload className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr("Import", "导入")}
                  </span>
                </div>
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-1.5 sm:px-2 py-1 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer h-7"
                  onClick={onExportHotkeys}
                >
                  <Download className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tr("Export", "导出")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center space-x-3">
              <div className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex-1">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500">
                  {shortcutsEnabled ? (
                    <RefreshCw className="w-3 h-3 text-white" />
                  ) : (
                    <X className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {shortcutsEnabled
                      ? tr("Shortcuts Active", "快捷键已启用")
                      : tr("Shortcuts Disabled", "快捷键已关闭")}
                  </span>
                </div>
                <Switch
                  checked={shortcutsEnabled}
                  onCheckedChange={setShortcutsEnabled}
                  className="data-[state=checked]:bg-gray-600 data-[state=unchecked]:bg-gray-400"
                />
              </div>
            </div>
          </div>

          {/* 冲突提示 */}
          {shortcutConflict && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {tr("Shortcut Conflict Detected!", "检测到快捷键冲突！")}
                    </h4>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-7 px-2 text-xs"
                      >
                        {tr("Dismiss", "忽略")}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                        onClick={() =>
                          onShowResetConfirmation(
                            tr("Fix Shortcut Conflicts", "修复快捷键冲突"),
                            tr(
                              "Automatically resolve conflicts by resetting conflicting shortcuts to defaults?",
                              "自动重置冲突的快捷键为默认值以解决冲突？"
                            ),
                            onResetToDefaults
                          )
                        }
                      >
                        {tr("Fix Automatically", "自动修复")}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    {tr(
                      `Shortcut ${shortcutConflict.shortcut} is already used by ${shortcutConflict.conflictingAction}. Please choose a different shortcut.`,
                      `快捷键 ${shortcutConflict.shortcut} 已被 ${shortcutConflict.conflictingAction} 占用，请选择其他快捷键。`
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 导航类 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <Navigation className="w-3 h-3 mr-1" />
              {tr("Navigation & Interface Controls", "导航与界面控制")}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onShowResetConfirmation(
                    tr("Reset Navigation Shortcuts", "重置导航快捷键"),
                    tr(
                      "Are you sure you want to reset all Navigation & Interface Controls shortcuts to their default values? This action cannot be undone.",
                      "确定要重置导航与界面控制相关的全部快捷键吗？该操作不可撤销。"
                    ),
                    onResetNavigationShortcuts
                  )
                }
                className="text-xs px-2 py-1 h-6 ml-2"
              >
                {tr("Reset", "重置")}
              </Button>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {navigationShortcuts.map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex justify-between items-center p-2 bg-gray-50 dark:bg-[#565869] rounded-lg"
                >
                  <div>
                    <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                      {shortcut.action}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {shortcut.description}
                    </p>
                  </div>
                  {renderShortcutDisplay(shortcut)}
                </div>
              ))}
            </div>
          </div>

          {/* 模型类 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <Bot className="w-3 h-3 mr-1" />
              {tr("AI Model Shortcuts", "模型快捷键")}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onShowResetConfirmation(
                    tr("Reset AI Model Shortcuts", "重置模型快捷键"),
                    tr(
                      "Are you sure you want to reset all AI Model shortcuts to their default values? This action cannot be undone.",
                      "确定要重置所有模型快捷键为默认值吗？该操作不可撤销。"
                    ),
                    onResetAIModelShortcuts
                  )
                }
                className="text-xs px-2 py-1 h-6 ml-2"
              >
                {tr("Reset", "重置")}
              </Button>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {modelShortcuts.map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex justify-between items-center p-2 bg-gray-50 dark:bg-[#565869] rounded-lg"
                >
                  <div>
                    <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                      {shortcut.action}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {shortcut.description}
                    </p>
                  </div>
                  {renderShortcutDisplay(shortcut)}
                </div>
              ))}
            </div>
          </div>

          {/* Prompt 管理 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              {tr("Prompts Management", "Prompt 管理")}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onShowResetConfirmation(
                    tr("Reset Prompts Management", "重置 Prompt 管理快捷键"),
                    tr(
                      "Are you sure you want to reset all Prompts Management shortcuts to their default values? This action cannot be undone.",
                      "确定要重置所有 Prompt 管理快捷键为默认值吗？该操作不可撤销。"
                    ),
                    onResetPromptsShortcuts
                  )
                }
                className="text-xs px-2 py-1 h-6 ml-2"
              >
                {tr("Reset", "重置")}
              </Button>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {promptShortcuts.map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex justify-between items-center p-2 bg-gray-50 dark:bg-[#565869] rounded-lg"
                >
                  <div>
                    <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                      {shortcut.action}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {shortcut.description}
                    </p>
                  </div>
                  {renderShortcutDisplay(shortcut)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

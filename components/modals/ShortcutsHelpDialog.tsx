"use client";

import React from "react";
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
import { DEFAULT_LANGUAGE } from "@/config";

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
  const isZh = DEFAULT_LANGUAGE === "zh";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[95vh] bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Keyboard className="w-4 h-4 text-blue-500" />
            <span className="text-lg">
              {isZh ? "自定义快捷键" : "Customize Hotkeys"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {isZh
              ? "配置键盘快捷键以提高效率。Mac 使用 Cmd，Windows/Linux 使用 Ctrl。"
              : "Configure your keyboard shortcuts for maximum productivity. Use Cmd on Mac, Ctrl on Windows/Linux."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Global Settings */}
          <div className="p-3 bg-gray-50 dark:bg-[#565869] rounded-lg border border-gray-200 dark:border-[#565869]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500">
                  <Settings className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1]">
                    Global Settings
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Manage shortcuts and preferences
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer h-7"
                  onClick={() =>
                    onShowResetConfirmation(
                      "Reset All Hotkeys",
                      "Are you sure you want to reset ALL hotkeys to their default values? This action cannot be undone.",
                      onResetToDefaults
                    )
                  }
                >
                  <RefreshCw className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Reset All
                  </span>
                </div>
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer h-7"
                  onClick={onImportHotkeys}
                >
                  <Upload className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Import
                  </span>
                </div>
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer h-7"
                  onClick={onExportHotkeys}
                >
                  <Download className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Export
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-600 h-7">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-500">
                    {shortcutsEnabled ? (
                      <Keyboard className="w-3 h-3 text-white" />
                    ) : (
                      <X className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {shortcutsEnabled
                        ? "Shortcuts Active"
                        : "Shortcuts Disabled"}
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
          </div>

          {/* Conflict Warning */}
          {shortcutConflict && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Shortcut Conflict Detected!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    Shortcut {shortcutConflict.shortcut} is already used by{" "}
                    {shortcutConflict.conflictingAction}. Please choose a
                    different shortcut.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation & Interface Controls */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <Navigation className="w-3 h-3 mr-1" />
              Navigation & Interface Controls
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onShowResetConfirmation(
                    "Reset Navigation Shortcuts",
                    "Are you sure you want to reset all Navigation & Interface Controls shortcuts to their default values? This action cannot be undone.",
                    onResetNavigationShortcuts
                  )
                }
                className="text-xs px-2 py-1 h-6 ml-2"
              >
                Reset
              </Button>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {[
                {
                  action: "New Chat",
                  current: "Ctrl/Cmd + K",
                  description: "Create a new conversation",
                },
                {
                  action: "Search Chats",
                  current: "Ctrl/Cmd + F",
                  description: "Focus the search bar",
                },
                {
                  action: "Toggle Sidebar",
                  current: "Ctrl/Cmd + B",
                  description: "Show/hide the sidebar",
                },
                {
                  action: "Settings",
                  current: "Ctrl/Cmd + S",
                  description: "Open settings dialog",
                },
                {
                  action: "Toggle Theme",
                  current: "Ctrl/Cmd + D",
                  description: "Switch light/dark mode",
                },
                {
                  action: "Ask GPT",
                  current: "Ctrl/Cmd + G",
                  description: "Open Ask GPT dialog",
                },
                {
                  action: "Downloads",
                  current: "Ctrl/Cmd + L",
                  description: "Open download section",
                },
                {
                  action: "Hotkeys Menu",
                  current: "Ctrl/Cmd + H",
                  description: "Open hotkeys configuration",
                },
                {
                  action: "Open Billing",
                  current: "Ctrl/Cmd + Q",
                  description: "Open billing management",
                },
                {
                  action: "Open Privacy",
                  current: "Ctrl/Cmd + Y",
                  description: "Open privacy settings",
                },
                {
                  action: "Close Dialogs",
                  current: "Ctrl/Cmd + I",
                  description: "Close any open dialog",
                },
              ].map((shortcut) => (
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

          {/* AI Model Shortcuts */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <Bot className="w-3 h-3 mr-1" />
              AI Model Shortcuts
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onShowResetConfirmation(
                    "Reset AI Model Shortcuts",
                    "Are you sure you want to reset all AI Model shortcuts to their default values? This action cannot be undone.",
                    onResetAIModelShortcuts
                  )
                }
                className="text-xs px-2 py-1 h-6 ml-2"
              >
                Reset
              </Button>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {[
                {
                  action: "Deep Thinking",
                  current: "Ctrl/Cmd + 1",
                  description: "Activate deep thinking mode",
                },
                {
                  action: "Creative Ideas",
                  current: "Ctrl/Cmd + 2",
                  description: "Generate creative ideas",
                },
                {
                  action: "Analyze",
                  current: "Ctrl/Cmd + 3",
                  description: "Provide detailed analysis",
                },
                {
                  action: "Problem Solve",
                  current: "Ctrl/Cmd + 4",
                  description: "Step-by-step problem solving",
                },
              ].map((shortcut) => (
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

          {/* Prompts Management */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              Prompts Management
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onShowResetConfirmation(
                    "Reset Prompts Management",
                    "Are you sure you want to reset all Prompts Management shortcuts to their default values? This action cannot be undone.",
                    onResetPromptsShortcuts
                  )
                }
                className="text-xs px-2 py-1 h-6 ml-2"
              >
                Reset
              </Button>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {[
                {
                  action: "Send Prompt",
                  current: "Enter",
                  description: "Send prompt with Enter key",
                },
                {
                  action: "Jump to Last",
                  current: "Ctrl/Cmd + J",
                  description: "Scroll to latest prompt",
                },
                {
                  action: "Jump to Top",
                  current: "Ctrl/Cmd + T",
                  description: "Scroll to chat beginning",
                },
                {
                  action: "Upload Files",
                  current: "Ctrl/Cmd + U",
                  description: "Open file upload dialog",
                },
                {
                  action: "Voice Input",
                  current: "Ctrl/Cmd + R",
                  description: "Toggle voice recording",
                },
                {
                  action: "Camera Input",
                  current: "Ctrl/Cmd + C",
                  description: "Open camera for photos/videos",
                },
                {
                  action: "Prompt History",
                  current: "Ctrl/Cmd + P",
                  description: "Open recent prompts",
                },
              ].map((shortcut) => (
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

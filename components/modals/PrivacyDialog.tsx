import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ShieldIcon, Download, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUser: any;
  setShowDeleteAccountDialog: (show: boolean) => void;
  setShowBillingDialog: (show: boolean) => void;
}

export function PrivacyDialog({
  open,
  onOpenChange,
  appUser,
  setShowDeleteAccountDialog,
  setShowBillingDialog,
}: PrivacyDialogProps) {
  const { currentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";
  const tr = (en: string, zh: string) => (isZh ? zh : en);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg bg-gradient-to-br from-white to-gray-50 dark:from-[#40414f] dark:to-[#2d2d30] border-gray-200 dark:border-[#565869] shadow-2xl rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader className="pb-3 border-b border-gray-100 dark:border-[#565869]">
          <DialogTitle className="flex items-center space-x-2 text-lg font-bold text-gray-900 dark:text-[#ececf1]">
            <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ShieldIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <span>{tr("Privacy & Security", "隐私与安全")}</span>
          </DialogTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {tr("Manage your account security and privacy settings", "管理账户的安全与隐私设置")}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Security Section */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
              {tr("Account Security", "账户安全")}
            </h3>

            {/* Change Password */}
            <div className="bg-white dark:bg-[#40414f] rounded-lg p-3 border border-gray-100 dark:border-[#565869] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                    <Lock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-[#ececf1]">
                      {tr("Password", "密码")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("Last changed: 30 days ago", "上次更改：30 天前")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] shadow-sm text-xs"
                >
                  {tr("Update", "修改")}
                </Button>
              </div>
            </div>

            {/* 2FA Method */}
            <div className="bg-white dark:bg-[#40414f] rounded-lg p-3 border border-gray-100 dark:border-[#565869] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-sm">
                    <ShieldIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-[#ececf1]">
                      {tr("Two-Factor Authentication", "双重验证")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("Status:", "状态：")}{" "}
                      <span className="text-orange-500 font-medium">
                        {tr("Not enabled", "未启用")}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] shadow-sm text-xs"
                >
                  {tr("Enable", "启用")}
                </Button>
              </div>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#ececf1] flex items-center">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></div>
              {tr("Data Privacy", "数据隐私")}
            </h3>

            {/* Data Export */}
            <div className="bg-white dark:bg-[#40414f] rounded-lg p-3 border border-gray-100 dark:border-[#565869] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-[#ececf1]">
                      {tr("Export Data", "导出数据")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("Download your personal data", "下载你的个人数据")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] shadow-sm text-xs"
                >
                  {tr("Export", "导出")}
                </Button>
              </div>
            </div>

            {/* Import Data */}
            <div
              className={`bg-white dark:bg-[#40414f] rounded-lg p-3 border border-gray-100 dark:border-[#565869] shadow-sm hover:shadow-md transition-shadow ${
                !appUser?.isPro ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-sm">
                    <Download className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-[#ececf1]">
                      {tr("Import Data", "导入数据")}
                    </p>
                    {!appUser?.isPro && (
                      <Lock className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {appUser?.isPro
                        ? tr("Import your data from other platforms", "从其他平台导入数据")
                        : tr("Pro feature - Upgrade to import data", "高级功能——升级后可导入数据")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!appUser?.isPro) {
                      onOpenChange(false);
                      setShowBillingDialog(true);
                    } else {
                      // Handle import data functionality for Pro users
                      console.log("Import data clicked");
                    }
                  }}
                  className={`${
                    appUser?.isPro
                      ? "bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                  } shadow-sm text-xs`}
                >
                  {appUser?.isPro ? tr("Import", "导入") : tr("Pro Only", "仅专业版")}
                </Button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-red-600 dark:text-red-400 flex items-center">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
              {tr("Danger Zone", "危险操作")}
            </h3>

            {/* Delete Account */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-[#7f1d1d] dark:to-[#831843] rounded-lg p-3 border border-red-200 dark:border-red-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-red-600 dark:text-red-400">
                      {tr("Delete Account", "删除账户")}
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {tr("This action cannot be undone", "该操作不可恢复")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setShowDeleteAccountDialog(true);
                  }}
                  className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 bg-white dark:bg-[#40414f] shadow-sm text-xs"
                >
                  {tr("Delete", "删除")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

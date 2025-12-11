"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Copy, RefreshCw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { createLocalizedTextGetter } from "@/lib/localization";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGeneratingLink: boolean;
  shareLink: string;
  shareSecret: string;
  makeDiscoverable: boolean;
  setMakeDiscoverable: (discoverable: boolean) => void;
  copyShareLink: () => void;
  copyShareSecret: () => void;
  regenerateSecretKey: () => void;
  shareToSocialMedia: (platform: string) => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onOpenChange,
  isGeneratingLink,
  shareLink,
  shareSecret,
  makeDiscoverable,
  setMakeDiscoverable,
  copyShareLink,
  copyShareSecret,
  regenerateSecretKey,
  shareToSocialMedia,
}) => {
  const { currentLanguage } = useLanguage();
  const t = React.useMemo(() => createLocalizedTextGetter(currentLanguage), [currentLanguage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm-max-w-md sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Upload className="w-5 h-5 text-blue-500" />
            <span className="text-lg">{t("shareConversation")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isGeneratingLink ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 dark:text-gray-400">
                  {t("shareGeneratingLink")}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                    {t("shareLinkLabel")}
                  </Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      value={shareLink}
                      readOnly
                      className="flex-1 bg-gray-50 dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                      placeholder={t("shareLinkPlaceholder")}
                    />
                    <Button
                      size="sm"
                      onClick={copyShareLink}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {!makeDiscoverable && (
                  <div>
                    <Label className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
                      {t("shareSecretKeyLabel")}
                    </Label>
                    <div className="flex space-x-2 mt-1">
                      <Input
                        value={shareSecret}
                        readOnly
                        className="flex-1 bg-gray-50 dark:bg-[#565869] font-mono text-sm font-bold"
                        placeholder={t("shareSecretKeyPlaceholder")}
                      />
                      <Button
                        size="sm"
                        onClick={copyShareSecret}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch checked={makeDiscoverable} onCheckedChange={setMakeDiscoverable} />
                  <Label className="text-sm text-gray-700 dark:text-gray-300">
                    {t("shareMakePublic")}
                  </Label>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">?</span>
                    </div>
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">{t("shareHowTo")}</p>
                      {makeDiscoverable ? (
                        <p>{t("sharePublicDescription")}</p>
                      ) : (
                        <ol className="list-decimal list-inside space-y-1">
                          <li>{t("sharePrivateStep1")}</li>
                          <li>{t("sharePrivateStep2")}</li>
                          <li>{t("sharePrivateStep3")}</li>
                        </ol>
                      )}
                    </div>
                  </div>
                </div>

                {/* Social Media Sharing */}
                <div>
                  <Label className="text-sm font-medium text-gray-900 dark:text-[#ececf1] mb-2 block">
                    {t("shareToSocial")}
                  </Label>
                  <div className="grid grid-cols-5 gap-2">
                    {/* Twitter */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("twitter")}
                      className="h-8 p-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-700"
                      title={t("shareOnTwitter")}
                    >
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">??</span>
                      </div>
                    </Button>

                    {/* Facebook */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("facebook")}
                      className="h-8 p-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-700"
                      title={t("shareOnFacebook")}
                    >
                      <div className="w-4 h-4 bg-blue-600 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">f</span>
                      </div>
                    </Button>

                    {/* LinkedIn */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("linkedin")}
                      className="h-8 p-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-700"
                      title={t("shareOnLinkedIn")}
                    >
                      <div className="w-4 h-4 bg-blue-700 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">in</span>
                      </div>
                    </Button>

                    {/* WhatsApp */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("whatsapp")}
                      className="h-8 p-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 border-green-200 dark:border-green-700"
                      title={t("shareOnWhatsApp")}
                    >
                      <div className="w-4 h-4 bg-green-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">W</span>
                      </div>
                    </Button>

                    {/* Telegram */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("telegram")}
                      className="h-8 p-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-700"
                      title={t("shareOnTelegram")}
                    >
                      <div className="w-4 h-4 bg-blue-400 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">T</span>
                      </div>
                    </Button>

                    {/* Reddit */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("reddit")}
                      className="h-8 p-1 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border-orange-200 dark:border-orange-700"
                      title={t("shareOnReddit")}
                    >
                      <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">R</span>
                      </div>
                    </Button>

                    {/* Discord */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("discord")}
                      className="h-8 p-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-700"
                      title={t("shareOnDiscord")}
                    >
                      <div className="w-4 h-4 bg-purple-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">D</span>
                      </div>
                    </Button>

                    {/* Email */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("email")}
                      className="h-8 p-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 border-gray-200 dark:border-gray-700"
                      title={t("shareViaEmail")}
                    >
                      <div className="w-4 h-4 bg-gray-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">@</span>
                      </div>
                    </Button>

                    {/* Slack */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("slack")}
                      className="h-8 p-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-700"
                      title={t("shareOnSlack")}
                    >
                      <div className="w-4 h-4 bg-purple-600 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">S</span>
                      </div>
                    </Button>

                    {/* Instagram */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareToSocialMedia("instagram")}
                      className="h-8 p-1 bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20 dark:hover:bg-pink-900/30 border-pink-200 dark:border-pink-700"
                      title={t("shareOnInstagram")}
                    >
                      <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">IG</span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
          >
            {t("close")}
          </Button>
          {!isGeneratingLink && (
            <Button onClick={regenerateSecretKey} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("generateNewKey")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

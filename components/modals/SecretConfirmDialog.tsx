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
import { Shield, Copy } from "lucide-react";

interface SecretConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareSecret: string;
  shareLink: string;
  onCopySecret: () => void;
  onCopyLink: () => void;
}

export default function SecretConfirmDialog({
  open,
  onOpenChange,
  shareSecret,
  shareLink,
  onCopySecret,
  onCopyLink,
}: SecretConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Shield className="w-5 h-5 text-blue-500" />
            <span>Secret Key Generated</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  ⚠
                </span>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-2">
                  Important: Save your secret key!
                </p>
                <p>
                  This secret key is required to access the shared conversation.
                  Make sure to save it securely and share it only with intended
                  recipients.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
              Your Secret Key:
            </Label>
            <div className="flex space-x-2">
              <Input
                value={shareSecret}
                readOnly
                className="flex-1 bg-gray-50 dark:bg-[#565869] font-mono text-sm font-bold"
                placeholder="Secret key..."
              />
              <Button
                size="sm"
                onClick={onCopySecret}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
              Share Link:
            </Label>
            <div className="flex space-x-2">
              <Input
                value={shareLink}
                readOnly
                className="flex-1 bg-gray-50 dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                placeholder="Share link..."
              />
              <Button
                size="sm"
                onClick={onCopyLink}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                  💡
                </span>
              </div>
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">How to share:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy the share link above</li>
                  <li>Share the secret key with your recipient</li>
                  <li>They need both the link and secret key to access</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
            >
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";

interface DataCollectionNoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueAsGuest: () => void;
  onCreateAccount: () => void;
}

export default function DataCollectionNoticeDialog({
  open,
  onOpenChange,
  onContinueAsGuest,
  onCreateAccount,
}: DataCollectionNoticeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Database className="w-5 h-5 text-blue-500" />
            <span className="text-lg">Data Collection Notice</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="mb-2">
                As a guest user, you have full access to all features including
                model selection, bookmarks, and prompts.
              </p>
              <p className="mb-2">
                <strong>Important:</strong> Your personal chat history will not
                be saved unless you create an account.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    ℹ
                  </span>
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Training Data Collection:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Conversations stored in database for AI training</li>
                    <li>Model selection and usage patterns</li>
                    <li>Bookmark and prompt interactions</li>
                    <li>Performance analytics for model improvement</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                    ⚠
                  </span>
                </div>
                <div className="text-xs text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium mb-1">Personal Data Retention:</p>
                  <p>
                    Your personal chat history, bookmarks, and settings will not
                    be saved unless you create an account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            variant="outline"
            onClick={onContinueAsGuest}
            className="flex-1 border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
          >
            Continue as Guest
          </Button>
          <Button
            onClick={onCreateAccount}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

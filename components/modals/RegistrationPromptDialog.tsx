"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface RegistrationPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "feature" | "save_history" | "paid_model" | "general" | null;
  onContinueAsGuest: () => void;
  onCreateAccount: () => void;
}

export default function RegistrationPromptDialog({
  open,
  onOpenChange,
  type,
  onContinueAsGuest,
  onCreateAccount,
}: RegistrationPromptDialogProps) {
  const getTitle = () => {
    switch (type) {
      case "feature":
        return "Premium Feature";
      case "paid_model":
        return "Premium AI Model";
      case "save_history":
        return "Save Your History";
      default:
        return "Create Account";
    }
  };

  const getContent = () => {
    switch (type) {
      case "feature":
        return {
          description: (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="mb-2">
                This feature requires a registered account.
              </p>
              <p>
                Sign up now to access all premium features and save your
                conversation history!
              </p>
            </div>
          ),
          benefits: [
            "Unlimited conversations",
            "Save chat history",
            "Access from any device",
            "Advanced AI models",
          ],
        };
      case "save_history":
        return {
          description: (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="mb-2">
                Your conversation history will be lost when you leave.
              </p>
              <p>
                Create an account to save your chats and access them from
                anywhere!
              </p>
            </div>
          ),
          benefits: [
            "Unlimited conversations",
            "Save chat history",
            "Access from any device",
            "Advanced AI models",
          ],
        };
      case "paid_model":
        return {
          description: (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="mb-2">
                This premium AI model requires a paid subscription.
              </p>
              <p>
                Sign up and upgrade to access advanced AI models like GPT-4,
                Claude 3.5, and more!
              </p>
            </div>
          ),
          benefits: [
            "Access to GPT-4, Claude 3.5, and premium models",
            "Unlimited conversations with advanced AI",
            "Priority processing and faster responses",
            "Save chat history and access from anywhere",
          ],
        };
      default:
        return {
          description: null,
          benefits: [],
        };
    }
  };

  const { description, benefits } = getContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none transition-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Crown className="w-5 h-5 text-yellow-500" />
            <span className="text-lg">{getTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3">
            {description}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    ✓
                  </span>
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">
                    {type === "paid_model"
                      ? "Premium Account Benefits:"
                      : "Free Account Benefits:"}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
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
            {type === "paid_model" ? "Sign Up & Upgrade" : "Create Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

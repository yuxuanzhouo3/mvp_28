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

interface ResetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ResetConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onCancel,
  onConfirm,
}: ResetConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="text-lg">{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

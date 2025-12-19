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
import { Folder } from "lucide-react";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  setFolderName: (name: string) => void;
  folderColor: string;
  setFolderColor: (color: string) => void;
  onCreate: () => void;
}

export default function CreateFolderDialog({
  open,
  onOpenChange,
  folderName,
  setFolderName,
  folderColor,
  setFolderColor,
  onCreate,
}: CreateFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Folder className="w-5 h-5 text-blue-500" />
            <span className="text-lg">Create New Folder</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label
              htmlFor="folder-name"
              className="text-sm font-medium text-gray-900 dark:text-[#ececf1]"
            >
              Folder Name
            </Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name..."
              className="mt-1 bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate();
                if (e.key === "Escape") onOpenChange(false);
              }}
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-900 dark:text-[#ececf1]">
              Folder Color
            </Label>
            <div className="mt-1 flex space-x-2">
              {[
                "#6B7280",
                "#EF4444",
                "#F59E0B",
                "#10B981",
                "#3B82F6",
                "#8B5CF6",
                "#EC4899",
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => setFolderColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    folderColor === color
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-gray-300 dark:border-gray-600 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
          >
            Cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={!folderName.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Create Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

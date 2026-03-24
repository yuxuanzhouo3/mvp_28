import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { PaletteIcon } from "lucide-react";

interface FontDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FontDialog({ open, onOpenChange }: FontDialogProps) {
  const [fontFamily, setFontFamily] = React.useState("default");
  const [fontSize, setFontSize] = React.useState("14");

  const handleSave = () => {
    console.log("Font settings saved:", { fontFamily, fontSize });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] rounded-2xl sm:rounded-3xl data-[state=open]:animate-none data-[state=closed]:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <PaletteIcon className="w-5 h-5 text-purple-600" />
            <span>Font Settings</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Font Family
            </Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger className="w-full bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]">
                <span>Default</span>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                <SelectItem
                  value="default"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  Default
                </SelectItem>
                <SelectItem
                  value="arial"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  Arial
                </SelectItem>
                <SelectItem
                  value="times"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  Times New Roman
                </SelectItem>
                <SelectItem
                  value="mono"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  Monospace
                </SelectItem>
                <SelectItem
                  value="serif"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  Serif
                </SelectItem>
                <SelectItem
                  value="sans"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  Sans Serif
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Font Size
            </Label>
            <Select value={fontSize} onValueChange={setFontSize}>
              <SelectTrigger className="w-full bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869]">
                <span>14px</span>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                <SelectItem
                  value="12"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  12px
                </SelectItem>
                <SelectItem
                  value="14"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  14px
                </SelectItem>
                <SelectItem
                  value="16"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  16px
                </SelectItem>
                <SelectItem
                  value="18"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  18px
                </SelectItem>
                <SelectItem
                  value="20"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  20px
                </SelectItem>
                <SelectItem
                  value="24"
                  className="text-gray-900 dark:text-[#ececf1]"
                >
                  24px
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-300 dark:border-[#565869]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

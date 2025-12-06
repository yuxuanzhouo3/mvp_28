import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

interface ShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutDialog({ open, onOpenChange }: ShortcutDialogProps) {
  const [shortcutsEnabled, setShortcutsEnabled] = React.useState(true);

  const handleSave = () => {
    console.log("Shortcut settings saved:", { shortcutsEnabled });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-gray-900 dark:text-[#ececf1]">
            <Zap className="w-5 h-5 text-yellow-600" />
            <span>Keyboard Shortcuts</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                  Send Message
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send current message
                </p>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-[#40414f]">
                ⌘ + Enter
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                  New Chat
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Start a new conversation
                </p>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-[#40414f]">
                ⌘ + N
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#565869] rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-[#ececf1]">
                  Toggle Theme
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Switch between light/dark
                </p>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-[#40414f]">
                ⌘ + T
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-gray-700 dark:text-gray-300">
              Enable Shortcuts
            </Label>
            <Switch
              checked={shortcutsEnabled}
              onCheckedChange={setShortcutsEnabled}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-300 dark:border-[#565869]"
            >
              Close
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

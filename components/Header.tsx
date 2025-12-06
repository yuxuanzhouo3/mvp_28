"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Crown,
  LogIn,
  LogOut,
  Settings,
  Sun,
  Moon,
  Upload,
  ChevronDown,
  User,
} from "lucide-react";

interface HeaderProps {
  currentChat: any;
  appUser: any;
  isGeneratingLink: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  prompt: string;
  detectLanguage: (text: string) => string;
  toggleTheme: () => void;
  isDarkMode: boolean;
  setShowSettingsDialog: (show: boolean) => void;
  confirmLogout: () => void;
  setShowAuthDialog: (show: boolean) => void;
  generateShareLink: () => Promise<void>;
  getLocalizedText: (key: string) => string;
  messages: any[];
  guestChatSessions: any[];
  currentChatId: string;
}

export default function Header({
  currentChat,
  appUser,
  isGeneratingLink,
  selectedLanguage,
  setSelectedLanguage,
  prompt,
  detectLanguage,
  toggleTheme,
  isDarkMode,
  setShowSettingsDialog,
  confirmLogout,
  setShowAuthDialog,
  generateShareLink,
  getLocalizedText,
  messages,
  guestChatSessions,
  currentChatId,
}: HeaderProps) {
  return (
    <header className="bg-white dark:bg-[#40414f] border-b border-gray-200 dark:border-[#40414f] shadow-sm transition-colors">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#ececf1]">
              {getLocalizedText("mornGPT")}
            </h1>
            {currentChat && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                - {currentChat.title}
              </span>
            )}
            {!appUser && (
              <Badge
                variant="outline"
                className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                title="Data will not be saved unless you login"
              >
                {getLocalizedText("guestUser")}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* Share Link Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!appUser) {
                  // setRegistrationPromptType("feature");
                  // setShowRegistrationPrompt(true);
                  return;
                }
                await generateShareLink();
              }}
              disabled={
                !currentChat ||
                (appUser
                  ? messages.length === 0
                  : guestChatSessions.find((c) => c.id === currentChatId)
                      ?.messages.length === 0)
              }
              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !appUser
                  ? getLocalizedText("signUpToShare")
                  : !currentChat
                  ? getLocalizedText("noChatSelected")
                  : (
                      appUser
                        ? messages.length === 0
                        : guestChatSessions.find((c) => c.id === currentChatId)
                            ?.messages.length === 0
                    )
                  ? getLocalizedText("noConversationToShare")
                  : getLocalizedText("shareConversation")
              }
            >
              {isGeneratingLink ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </Button>
            {/* Language Selector */}
            <div className="flex items-center space-x-1">
              <Select
                value={selectedLanguage}
                onValueChange={setSelectedLanguage}
              >
                <SelectTrigger className="h-8 w-20 text-xs bg-white dark:bg-[#40414f] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]">
                  <span>{selectedLanguage === "en" ? "EN" : "中文"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
              {prompt && detectLanguage(prompt) !== selectedLanguage && (
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                  title="Language will be auto-detected from your input"
                ></div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            {appUser ? (
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-40 bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
                    >
                      <div className="flex items-center space-x-2">
                        {appUser.isPro && (
                          <Crown className="w-4 h-4 text-gray-900 dark:text-gray-100" />
                        )}
                        <User className="w-4 h-4" />
                        <span className="truncate">{appUser.name}</span>
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] p-1">
                    <div className="space-y-1">
                      {appUser && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                          onClick={() => setShowSettingsDialog(true)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          {getLocalizedText("setting")}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        className="w-full justify-start text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                        onClick={confirmLogout}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {getLocalizedText("signOut")}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Button
                onClick={() => setShowAuthDialog(true)}
                variant="outline"
                size="sm"
                className="bg-white dark:bg-[#40414f] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869]"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {getLocalizedText("login")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

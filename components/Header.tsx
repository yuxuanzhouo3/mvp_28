"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  currentPlan?: "Basic" | "Pro" | "Enterprise" | null;
  planExp?: string | null;
  setShowUpgradeDialog: (show: boolean) => void;
  isDomestic: boolean;
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
  setShowUpgradeDialog,
  currentPlan,
  planExp,
  isDomestic,
}: HeaderProps) {
  const tier =
    appUser ? currentPlan || (appUser?.isPro ? "Pro" : null) : null;
  const tierDisplay = tier || (appUser ? "Free" : "Guest User");
  const tierClass =
    tier === "Enterprise"
      ? "bg-purple-600 text-white"
      : tier === "Pro"
      ? "bg-blue-600 text-white"
      : tier === "Basic"
      ? "bg-amber-500 text-white"
      : "bg-gray-200 text-gray-800";

  return (
    <header className="bg-white dark:bg-[#40414f] border-b border-gray-200 dark:border-[#40414f] shadow-sm transition-colors">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#ececf1]">
              {getLocalizedText("mornGPT")}
            </h1>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 border-0 ${
                      appUser
                        ? tierClass
                        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {tierDisplay}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {appUser ? (
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-50">
                        {tierDisplay}
                      </div>
                      {planExp ? (
                        <div className="text-gray-600 dark:text-gray-300">
                          Expires: {new Date(planExp).toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-gray-600 dark:text-gray-300">
                          Active subscription
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-700 dark:text-gray-200">
                      Guest session (data not saved)
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {currentChat && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                - {currentChat.title}
              </span>
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
            {appUser && !isDomestic && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpgradeDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
                title={getLocalizedText("Choose Your MornGPT Plan")}
              >
                <Crown className="w-4 h-4" />
              </Button>
            )}
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

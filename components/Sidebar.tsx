"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useIsMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Folder,
  FolderOpen,
  MessageSquare,
  Sparkles,
  Globe,
  Edit3,
  Upload,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Menu,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import { ChatSession, BookmarkFolder } from "../types";
import { specializedProducts } from "../constants";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AdBanner from "@/components/AdBanner";

// 社交链接类型定义
interface SocialLinkData {
  id: string;
  title: string;
  description: string | null;
  icon_url: string;
  target_url: string;
  sort_order: number;
}

interface SidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarWidth: number;
  handleSidebarResizeStart: (e: React.MouseEvent) => void;
  createNewChat: (category?: string, modelType?: string, model?: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedFolders: string[];
  toggleFolder: (folder: string) => void;
  groupedChats: Record<string, ChatSession[]>;
  currentChatId: string;
  selectChat: (chatId: string) => void;
  editingChatId: string | null;
  setEditingChatId: (id: string) => void;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  saveTitle: () => void;
  cancelEditing: () => void;
  deleteChat: (chatId: string) => void;
  exportChat: (chatId: string) => void;
  setShowShareDialog: (show: boolean) => void;
  truncateText: (text: string, maxLength: number) => string;
  appUser: any;
  updateUserSettings: (settings: Partial<any>) => void;
  showDownloadSection: boolean;
  setShowDownloadSection: (show: boolean) => void;
  handleSpecializedProductSelect: (product: any) => void;
  setIsResizing: (isResizing: boolean) => void;
  getLocalizedText: (key: string) => string;
  isSidebarLoading: boolean;
  isDomestic?: boolean;
  // 全局广告显示状态（从父组件传入，用于控制全局广告）
  showGlobalAds?: boolean;
  setShowGlobalAds?: (show: boolean) => void;
  // 升级弹窗控制（用于广告关闭时弹出）
  setShowUpgradeDialog?: (show: boolean) => void;
  // 是否应该显示广告（根据订阅状态计算，由父组件传入）
  shouldShowAds?: boolean;
}

export default function Sidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  handleSidebarResizeStart,
  createNewChat,
  searchQuery,
  setSearchQuery,
  expandedFolders,
  toggleFolder,
  groupedChats,
  currentChatId,
  selectChat,
  editingChatId,
  setEditingChatId,
  editingTitle,
  setEditingTitle,
  saveTitle,
  cancelEditing,
  deleteChat,
  setShowShareDialog,
  truncateText,
  appUser,
  exportChat,
  updateUserSettings,
  showDownloadSection,
  setShowDownloadSection,
  handleSpecializedProductSelect,
  setIsResizing,
  getLocalizedText,
  isSidebarLoading,
  isDomestic = false,
  showGlobalAds = true,
  setShowGlobalAds,
  setShowUpgradeDialog,
  shouldShowAds = true,
}: SidebarProps) {
  const { currentLanguage } = useLanguage();
  const isMobile = useIsMobile();
  // 国内版移动端隐藏 MornGPT 文件夹
  const hideMornGPTFolder = isDomestic && isMobile;
  const canCloseAdsForUpsell = !appUser?.isPaid;

  // 社交链接数据状态
  const [socialLinks, setSocialLinks] = useState<SocialLinkData[]>([]);
  const [socialLinksLoading, setSocialLinksLoading] = useState(true);

  // 侧边栏广告是否有内容
  const [hasAds, setHasAds] = useState(true);

  // 侧边栏本地广告显示状态（仅控制侧边栏广告显示/社交链接切换）
  // 默认显示广告，用户点击小眼睛后切换到社交链接
  const [showSidebarAd, setShowSidebarAd] = useState(true);

  // 获取社交链接数据
  useEffect(() => {
    async function fetchSocialLinks() {
      try {
        const response = await fetch(`/api/social-links/active?isDomestic=${isDomestic}`);
        const result = await response.json();
        if (result.success && result.data) {
          setSocialLinks(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch social links:", err);
      } finally {
        setSocialLinksLoading(false);
      }
    }

    fetchSocialLinks();
  }, [isDomestic]);

  // 处理社交链接点击
  const handleSocialLinkClick = (link: SocialLinkData) => {
    if (link.target_url) {
      window.open(link.target_url, "_blank", "noopener,noreferrer");
    }
  };

  // 合并数据：优先使用 API 数据，如果没有则使用静态数据作为后备
  const displayLinks = socialLinks.length > 0 ? socialLinks : specializedProducts.map(p => ({
    id: p.id,
    title: p.name,
    description: p.description,
    icon_url: p.icon, // 这是 emoji，需要特殊处理
    target_url: p.url,
    sort_order: 0,
  }));

  // 判断是否是 URL（用于区分 emoji 和图片 URL）
  const isImageUrl = (url: string) => {
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('cloud://');
  };

  return (
    <>
      {/* Left Sidebar - Chat History - 展开时固定宽度或可调整宽度 */}
      {!sidebarCollapsed && (
        <div
          className="bg-white dark:bg-[#40414f] border-r border-gray-200 dark:border-[#565869] flex flex-col transition-all duration-300 ease-in-out relative h-screen animate-in slide-in-from-left-4"
          style={{ width: sidebarWidth > 0 ? `${sidebarWidth}px` : '280px' }}
        >
        {/* Resize handle */}
        {!sidebarCollapsed && (
          <div
            className="absolute right-0 top-0 w-1 h-full bg-gray-300 dark:bg-gray-600 cursor-ew-resize hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200 z-10"
            onMouseDown={handleSidebarResizeStart}
            title="Drag to resize sidebar"
          />
        )}
        {!sidebarCollapsed && (
          <div className="relative h-full flex flex-col">
            <div className="p-2 sm:p-3 border-b border-gray-200 dark:border-[#565869] space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => createNewChat()}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white h-10"
                >
                  <Plus className="w-4 h-4" />
                  <span>{getLocalizedText("newChat")}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDownloadSection(!showDownloadSection)}
                  className="h-10 w-10 p-0 text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] flex-shrink-0"
                  title={getLocalizedText("downloadApps")}
                >
                  <Download className="w-4 h-4" />
                </Button>

                {/* 移动端关闭按钮 - 仅在小屏幕显示 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed?.(true)}
                  className="md:hidden h-10 w-10 p-0 text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] flex-shrink-0"
                  title="关闭侧边栏"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder={getLocalizedText("searchChats")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 sm:h-8 text-sm bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] border-gray-300 dark:border-[#565869]"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[calc(100vh-200px)] relative">
              <div className="p-1.5 sm:p-2 relative">
                {isSidebarLoading ? (
                  <div className="space-y-2 w-full px-2 py-3 animate-pulse">
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <div
                        key={`skeleton-${idx}`}
                        className="h-6 rounded-md bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-[#3a3b42] dark:via-[#32333c] dark:to-[#2a2b33]"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                {/* General Folder */}
                <div className="mb-1">
                  <ContextMenu>
                    <ContextMenuTrigger>
                      <div
                        className="flex items-center space-x-1.5 p-1.5 hover:bg-gray-100 dark:hover:bg-[#565869] rounded cursor-pointer"
                        onClick={() => toggleFolder("general")}
                      >
                        {expandedFolders.includes("general") ? (
                          <FolderOpen className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        )}
                        <MessageSquare className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                          General
                        </span>
                        <ChevronRight
                          className={`w-2.5 h-2.5 text-gray-400 transition-transform ${
                            expandedFolders.includes("general")
                              ? "rotate-90"
                              : ""
                          }`}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <ContextMenuItem
                        onClick={() =>
                          createNewChat("general", "general", "General")
                        }
                        className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                      >
                      <Plus className="w-4 h-4 mr-2" />
                      {getLocalizedText("newChatInGeneral")}
                    </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  {expandedFolders.includes("general") && (
                    <div className="ml-3 sm:ml-5 space-y-0.5">
                      {(groupedChats.general || []).map((chat) => (
                        <ContextMenu key={chat.id}>
                          <ContextMenuTrigger>
                            <div
                              className={`group p-2 sm:p-1.5 rounded cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-[#565869] ${
                                currentChatId === chat.id
                                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                              onClick={() => selectChat(chat.id)}
                              onDoubleClick={() => {
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                              }}
                            >
                              <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden">
                                <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                {editingChatId === chat.id ? (
                                  <div className="flex items-center space-x-1 flex-1">
                                    <Input
                                      value={editingTitle}
                                      onChange={(e) =>
                                        setEditingTitle(e.target.value)
                                      }
                                      className="h-5 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1] max-w-[8rem]"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveTitle();
                                        if (e.key === "Escape") cancelEditing();
                                      }}
                                      maxLength={10}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      onClick={saveTitle}
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      onClick={cancelEditing}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      className="truncate flex-1 min-w-0 text-gray-700 dark:text-gray-300"
                                      title={chat.title}
                                    >
                                      {truncateText(chat.title, 10)}
                                    </span>
                                    <div className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex items-center space-x-0.5">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-[#565869]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingChatId(chat.id);
                                          setEditingTitle(chat.title);
                                        }}
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                      </Button>
                                      {appUser?.plan &&
                                        ["pro", "enterprise"].includes(
                                          String(appUser.plan).toLowerCase()
                                        ) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-[#565869]"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              exportChat(chat.id);
                                            }}
                                            disabled={chat.messages.length === 0}
                                            title={
                                              chat.messages.length === 0
                                                ? "No messages to export"
                                                : "Export conversation"
                                            }
                                          >
                                            <Download className="w-2.5 h-2.5" />
                                          </Button>
                                        )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteChat(chat.id);
                                        }}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                            <ContextMenuItem
                              onClick={() => {
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                              }}
                              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Rename
                            </ContextMenuItem>
                            {appUser?.plan &&
                              ["pro", "enterprise"].includes(
                                String(appUser.plan).toLowerCase()
                              ) && (
                                <ContextMenuItem
                                  onClick={() => exportChat(chat.id)}
                                  disabled={chat.messages.length === 0}
                                  className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export
                                </ContextMenuItem>
                              )}
                            <ContextMenuItem
                              onClick={() => deleteChat(chat.id)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}
                </div>

                {/* MornGPT Folder - 国内版移动端隐藏 */}
                {!hideMornGPTFolder && (
                <div className="mb-1">
                  <ContextMenu>
                    <ContextMenuTrigger>
                      <div
                        className="flex items-center space-x-1.5 p-1.5 hover:bg-gray-100 dark:hover:bg-[#565869] rounded cursor-pointer"
                        onClick={() => toggleFolder("morngpt")}
                      >
                        {expandedFolders.includes("morngpt") ? (
                          <FolderOpen className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        )}
                        <Sparkles className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                          {getLocalizedText("appName")}
                        </span>
                        <ChevronRight
                          className={`w-2.5 h-2.5 text-gray-400 transition-transform ${
                            expandedFolders.includes("morngpt") ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <ContextMenuItem
                        onClick={() => createNewChat(undefined, "morngpt")}
                        className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {getLocalizedText("newMornGPTChat")}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  {expandedFolders.includes("morngpt") && (
                    <div className="ml-5 space-y-0.5">
                      {(groupedChats.morngpt || []).map((chat) => (
                        <ContextMenu key={chat.id}>
                          <ContextMenuTrigger>
                            <div
                              className={`group p-1.5 rounded cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-[#565869] ${
                                currentChatId === chat.id
                                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                              onClick={() => selectChat(chat.id)}
                              onDoubleClick={() => {
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                              }}
                            >
                              <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden">
                                <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                {editingChatId === chat.id ? (
                                  <div className="flex items-center space-x-1 flex-1">
                                    <Input
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      className="h-5 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1]"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveTitle();
                                        if (e.key === "Escape") cancelEditing();
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      onClick={saveTitle}
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      onClick={cancelEditing}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      className="truncate flex-1 min-w-0 text-gray-700 dark:text-gray-300"
                                      title={chat.title}
                                    >
                                      {truncateText(chat.title, 10)}
                                    </span>
                                    <div className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex items-center space-x-0.5">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-[#565869]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingChatId(chat.id);
                                          setEditingTitle(chat.title);
                                        }}
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                      </Button>
                                      {appUser?.plan &&
                                        ["pro", "enterprise"].includes(
                                          String(appUser.plan).toLowerCase()
                                        ) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-[#565869]"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              exportChat(chat.id);
                                            }}
                                            disabled={chat.messages.length === 0}
                                            title={
                                              chat.messages.length === 0
                                                ? "No messages to export"
                                                : "Export conversation"
                                            }
                                          >
                                            <Download className="w-2.5 h-2.5" />
                                          </Button>
                                        )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteChat(chat.id);
                                        }}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                            <ContextMenuItem
                              onClick={() => {
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                              }}
                              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Rename
                            </ContextMenuItem>
                            {appUser?.plan &&
                              ["pro", "enterprise"].includes(
                                String(appUser.plan).toLowerCase()
                              ) && (
                                <ContextMenuItem
                                  onClick={() => exportChat(chat.id)}
                                  disabled={chat.messages.length === 0}
                                  className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export
                                </ContextMenuItem>
                              )}
                            <ContextMenuItem
                              onClick={() => deleteChat(chat.id)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* External Folder */}
                <div className="mb-1">
                  <ContextMenu>
                    <ContextMenuTrigger>
                      <div
                        className="flex items-center space-x-1.5 p-1.5 hover:bg-gray-100 dark:hover:bg-[#565869] rounded cursor-pointer"
                        onClick={() => toggleFolder("external")}
                      >
                        {expandedFolders.includes("external") ? (
                          <FolderOpen className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        )}
                        <Globe className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-900 dark:text-[#ececf1]">
                          External
                        </span>
                        <ChevronRight
                          className={`w-2.5 h-2.5 text-gray-400 transition-transform ${
                            expandedFolders.includes("external") ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                      <ContextMenuItem
                        onClick={() => createNewChat(undefined, "external")}
                        className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {currentLanguage === "zh" ? "新建 External 对话" : "New External Chat"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  {expandedFolders.includes("external") && (
                    <div className="ml-5 space-y-0.5">
                      {(groupedChats.external || []).map((chat) => (
                        <ContextMenu key={chat.id}>
                          <ContextMenuTrigger>
                            <div
                              className={`group p-1.5 rounded cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-[#565869] ${
                                currentChatId === chat.id
                                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                              onClick={() => selectChat(chat.id)}
                              onDoubleClick={() => {
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                              }}
                            >
                              <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden">
                                <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                {editingChatId === chat.id ? (
                                  <div className="flex items-center space-x-1 flex-1">
                                    <Input
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      className="h-5 text-xs bg-white dark:bg-[#565869] text-gray-900 dark:text-[#ececf1]"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveTitle();
                                        if (e.key === "Escape") cancelEditing();
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      onClick={saveTitle}
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0"
                                      onClick={cancelEditing}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      className="truncate flex-1 min-w-0 text-gray-700 dark:text-gray-300"
                                      title={chat.title}
                                    >
                                      {truncateText(chat.title, 10)}
                                    </span>
                                    <div className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex items-center space-x-0.5">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-[#565869]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingChatId(chat.id);
                                          setEditingTitle(chat.title);
                                        }}
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                      </Button>
                                      {appUser?.plan &&
                                        ["pro", "enterprise"].includes(
                                          String(appUser.plan).toLowerCase()
                                        ) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-[#565869]"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              exportChat(chat.id);
                                            }}
                                            disabled={chat.messages.length === 0}
                                            title={
                                              chat.messages.length === 0
                                                ? "No messages to export"
                                                : "Export conversation"
                                            }
                                          >
                                            <Download className="w-2.5 h-2.5" />
                                          </Button>
                                        )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteChat(chat.id);
                                        }}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869]">
                            <ContextMenuItem
                              onClick={() => {
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                              }}
                              className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869]"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Rename
                            </ContextMenuItem>
                            {appUser?.plan &&
                              ["pro", "enterprise"].includes(
                                String(appUser.plan).toLowerCase()
                              ) && (
                                <ContextMenuItem
                                  onClick={() => exportChat(chat.id)}
                                  disabled={chat.messages.length === 0}
                                  className="text-gray-900 dark:text-[#ececf1] hover:bg-gray-100 dark:hover:bg-[#565869] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export
                                </ContextMenuItem>
                              )}
                            <ContextMenuItem
                              onClick={() => deleteChat(chat.id)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* 底部固定区域：广告/社交链接 */}
            <div className="border-t border-gray-200 dark:border-[#565869] bg-white dark:bg-[#40414f] h-[200px] flex flex-col">
              {/* 广告/社交链接切换按钮 - 移动端无广告时隐藏 */}
              {!(isMobile && !shouldShowAds) && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-[#565869] shrink-0">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {showSidebarAd && shouldShowAds
                      ? getLocalizedText("advertisements")
                      : getLocalizedText("socialLinks")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSidebarAd(!showSidebarAd)}
                    className="h-6 w-6 p-0 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#565869]"
                    title={
                      showSidebarAd && shouldShowAds
                        ? getLocalizedText("showSocialLinks")
                        : getLocalizedText("showAds")
                    }
                  >
                    {showSidebarAd && shouldShowAds ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              )}

              {/* 移动端无广告时显示标题 */}
              {isMobile && !shouldShowAds && (
                <div className="px-3 py-2 border-b border-gray-200 dark:border-[#565869] shrink-0">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {getLocalizedText("socialLinks")}
                  </span>
                </div>
              )}

              {/* 广告显示区域 */}
              {shouldShowAds && showSidebarAd && hasAds && (
                <div className="flex-1 h-0 w-full">
                  <AdBanner
                    position="sidebar"
                    isDomestic={isDomestic}
                    showCloseButton={false}
                    className="w-full h-full"
                    onAdLoadComplete={(hasAdsData) => {
                      setHasAds(hasAdsData);
                      // 如果没有广告，自动切换到显示社交链接
                      if (!hasAdsData) {
                        setShowSidebarAd(false);
                      }
                    }}
                  />
                </div>
              )}

              {/* 社交链接显示区域 */}
              {(!shouldShowAds || !showSidebarAd || !hasAds) && (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {socialLinksLoading ? (
                      <div className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 12 }).map((_, idx) => (
                          <div
                            key={`skeleton-${idx}`}
                            className="w-full aspect-square rounded-md bg-gray-200 dark:bg-[#565869] animate-pulse"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 gap-2">
                        {displayLinks.map((link) => (
                          <Popover key={link.id}>
                            <PopoverTrigger asChild>
                              <button
                                className="w-full aspect-square rounded-md border border-gray-200 dark:border-[#565869] hover:bg-gray-50 dark:hover:bg-[#565869] transition-colors flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden"
                                onMouseEnter={(e) => e.currentTarget.focus()}
                              >
                                {isImageUrl(link.icon_url) ? (
                                  <img
                                    src={link.icon_url}
                                    alt={link.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement!.innerHTML = `<span class="text-2xl">${link.title.charAt(0)}</span>`;
                                    }}
                                  />
                                ) : (
                                  <span className="text-2xl">{link.icon_url}</span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="right"
                              align="center"
                              className="w-56 p-3 bg-white dark:bg-[#40414f] border-gray-200 dark:border-[#565869] shadow-lg cursor-pointer z-50"
                              onClick={() => handleSocialLinkClick(link)}
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  {isImageUrl(link.icon_url) ? (
                                    <img
                                      src={link.icon_url}
                                      alt={link.title}
                                      className="w-7 h-7 object-contain"
                                    />
                                  ) : (
                                    <span className="text-lg">{link.icon_url}</span>
                                  )}
                                  <div>
                                    <h4 className="font-medium text-gray-900 dark:text-[#ececf1] text-sm">
                                      {link.title}
                                    </h4>
                                    {link.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {link.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {link.target_url && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSocialLinkClick(link);
                                    }}
                                    className="w-full text-left text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 cursor-pointer truncate"
                                  >
                                    {getLocalizedText("clickToVisit")}:{" "}
                                    {link.target_url.replace("https://", "").replace("http://", "")}
                                  </button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Resize Handle */}
            <div
              className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors"
              onMouseDown={() => setIsResizing(true)}
            />
          </div>
        )}
      </div>
      )}
    </>
  );
}

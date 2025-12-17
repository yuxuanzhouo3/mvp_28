import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ModalHub from "@/features/chat/components/ModalHub";
import AdBanner from "@/components/AdBanner";
import { useChatUI } from "@/features/chat/providers/ChatProvider";

function ChatShell() {
  const {
    sidebarCollapsed,
    sidebarProps,
    headerProps,
    chatInterfaceProps,
    inputAreaProps,
    modalProps,
    ChatInterfaceComponent,
    InputAreaComponent,
  } = useChatUI() as any;

  // 广告关闭时显示升级弹窗
  const handleAdClose = () => {
    modalProps?.setShowUpgradeDialog?.(true);
  };

  // 从 headerProps 获取 isDomestic 参数
  const isDomestic = headerProps?.isDomestic ?? false;

  // 从 sidebarProps 获取全局广告显示状态
  const showGlobalAds = sidebarProps?.showGlobalAds ?? true;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#2d2d30] text-gray-900 dark:text-[#ececf1] flex">
      <Sidebar {...sidebarProps} isDomestic={isDomestic} />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col h-screen ${
          sidebarCollapsed ? "pl-12" : ""
        } md:pl-0 transition-[padding] duration-200`}
      >
        {/* Header - Fixed height */}
        <header className="bg-white dark:bg-[#40414f] border-b border-gray-200 dark:border-[#40414f] flex-shrink-0 transition-colors">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <Header {...headerProps} />
          </div>
        </header>

        {/* Chat Messages - Flexible height with scroll */}
        <ChatInterfaceComponent {...chatInterfaceProps} />

        {/* Input Area with optional Left/Right Ads - 底部栏统一背景 */}
        <div className="flex-shrink-0 bg-white dark:bg-[#40414f] border-t border-gray-200 dark:border-[#565869]">
          {/* 左右广告 + 输入框的横向布局 */}
          <div className="flex items-center px-4 py-3 gap-4">
            {/* 左侧广告位 - 从侧边栏到输入框，弹性填充（保留占位以保持输入框位置） */}
            <div className="flex-1 flex items-center min-w-0">
              {showGlobalAds && (
                <AdBanner
                  position="left"
                  isDomestic={isDomestic}
                  showCloseButton={true}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              )}
            </div>

            {/* Input Area - 中央主体，固定最大宽度 */}
            <div className="w-full max-w-4xl flex-shrink-0">
              <InputAreaComponent {...inputAreaProps} />
            </div>

            {/* 右侧广告位 - 从输入框到页面右侧，弹性填充（保留占位以保持输入框位置） */}
            <div className="flex-1 flex items-center min-w-0">
              {showGlobalAds && (
                <AdBanner
                  position="right"
                  isDomestic={isDomestic}
                  showCloseButton={true}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              )}
            </div>
          </div>

          {/* 底部广告行 - 底部左侧广告 + 底部广告 + 底部右侧广告 */}
          {showGlobalAds && (
            <div className="flex items-center px-4 pb-3 gap-4">
              {/* 底部左侧广告位 - 与左侧广告对齐 */}
              <div className="flex-1 flex items-center min-w-0">
                <AdBanner
                  position="bottom-left"
                  isDomestic={isDomestic}
                  showCloseButton={true}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              </div>

              {/* 底部广告位 - 输入框下方 */}
              <div className="w-full max-w-4xl flex-shrink-0">
                <AdBanner
                  position="bottom"
                  isDomestic={isDomestic}
                  showCloseButton={true}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-sm"
                />
              </div>

              {/* 底部右侧广告位 - 与右侧广告对齐 */}
              <div className="flex-1 flex items-center min-w-0">
                <AdBanner
                  position="bottom-right"
                  isDomestic={isDomestic}
                  showCloseButton={true}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <ModalHub {...modalProps} />
    </div>
  );
}

export default ChatShell;

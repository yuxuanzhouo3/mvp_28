import React, { useMemo } from "react";
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

  // 从 headerProps 获取 isDomestic 参数
  const isDomestic = headerProps?.isDomestic ?? false;

  // 获取用户信息
  const appUser = sidebarProps?.appUser;
  const canCloseAdsForUpsell = !appUser?.isPaid;

  // 从 sidebarProps 获取全局广告显示状态（仅控制侧边栏以外的广告临时隐藏）
  const showGlobalAds = sidebarProps?.showGlobalAds ?? true;

  /**
   * 计算是否应该显示广告
   * 规则：
   * 1. 订阅用户 + 开启了hideAds + 订阅未过期 = 不显示广告
   * 2. 订阅用户 + 未开启hideAds = 显示广告
   * 3. 订阅用户 + 订阅已过期 = 显示广告（自动恢复）
   * 4. Free用户 = 显示广告（可手动关闭单个广告，刷新后恢复）
   */
  const shouldShowAds = useMemo(() => {
    // 如果用户是订阅用户（Basic/Pro/Enterprise）
    if (appUser?.isPaid) {
      // 检查是否开启了去除广告功能
      if (appUser.settings?.hideAds) {
        // 检查订阅是否过期
        if (appUser.planExp) {
          const expDate = new Date(appUser.planExp);
          const now = new Date();
          // 订阅未过期，不显示广告
          if (expDate > now) {
            return false;
          }
          // 订阅已过期，显示广告
          return true;
        }
        // 没有过期时间但是isPaid，认为是有效订阅
        return false;
      }
      // 未开启hideAds，显示广告
      return true;
    }
    // Free用户，显示广告
    return true;
  }, [appUser?.isPaid, appUser?.settings?.hideAds, appUser?.planExp]);

  // 最终是否显示广告：shouldShowAds && showGlobalAds（Free用户关闭单个广告时临时隐藏）
  const displayAds = shouldShowAds && showGlobalAds;

  // 广告关闭时显示升级弹窗（仅Free用户）
  const handleAdClose = () => {
    if (canCloseAdsForUpsell) {
      modalProps?.setShowUpgradeDialog?.(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#2d2d30] text-gray-900 dark:text-[#ececf1] flex relative overflow-x-hidden">
      {/* 移动端/平板端遮罩层 - 当侧边栏展开时显示 */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => sidebarProps?.setSidebarCollapsed?.(true)}
        />
      )}

      {/* 侧边栏 - 移动端/平板端使用固定定位覆盖在上层 */}
      <div className={`
        lg:relative fixed inset-y-0 left-0 z-50
        transition-transform duration-300 ease-in-out
        ${sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
      `}>
        <Sidebar
          {...sidebarProps}
          isDomestic={isDomestic}
          shouldShowAds={shouldShowAds}
        />
      </div>

      {/* Main Content - 移动端/平板端不受侧边栏影响，桌面端正常布局 */}
      <div className="flex-1 flex flex-col h-screen overflow-x-hidden max-w-full">
        {/* Header - Fixed height */}
        <header className="bg-white dark:bg-[#40414f] border-b border-gray-200 dark:border-[#40414f] flex-shrink-0 transition-colors">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            {/* 覆盖 showGlobalAds，使用基于订阅状态计算的 displayAds */}
            <Header {...headerProps} showGlobalAds={displayAds} />
          </div>
        </header>

        {/* Chat Messages - Flexible height with scroll */}
        <ChatInterfaceComponent {...chatInterfaceProps} />

        {/* Input Area with optional Left/Right Ads - 底部栏统一背景 */}
        <div className="flex-shrink-0 bg-white dark:bg-[#40414f] border-t border-gray-200 dark:border-[#565869] overflow-x-hidden max-w-full">
          {/* 左右广告 + 输入框的横向布局 */}
          <div className="flex items-center px-1 sm:px-2 md:px-4 py-1.5 sm:py-2 md:py-3 gap-1 sm:gap-2 md:gap-4 overflow-x-hidden max-w-full">
            {/* 左侧广告位 - 仅桌面端显示 */}
            <div className="hidden lg:flex flex-1 items-center min-w-0">
              {displayAds && (
                <AdBanner
                  position="left"
                  isDomestic={isDomestic}
                  showCloseButton={canCloseAdsForUpsell}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              )}
            </div>

            {/* Input Area - 中央主体 */}
            <div className="w-full lg:max-w-4xl flex-1 lg:flex-shrink-0">
              <InputAreaComponent {...inputAreaProps} />
            </div>

            {/* 右侧广告位 - 仅桌面端显示 */}
            <div className="hidden lg:flex flex-1 items-center min-w-0">
              {displayAds && (
                <AdBanner
                  position="right"
                  isDomestic={isDomestic}
                  showCloseButton={canCloseAdsForUpsell}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              )}
            </div>
          </div>

          {/* 底部广告行 - 仅桌面端显示 */}
          {displayAds && (
            <div className="hidden lg:flex items-center px-4 pb-3 gap-4">
              {/* 底部左侧广告位 */}
              <div className="flex-1 flex items-center min-w-0">
                <AdBanner
                  position="bottom-left"
                  isDomestic={isDomestic}
                  showCloseButton={canCloseAdsForUpsell}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-md w-full"
                />
              </div>

              {/* 底部广告位 - 输入框下方 */}
              <div className="w-full max-w-4xl flex-shrink-0">
                <AdBanner
                  position="bottom"
                  isDomestic={isDomestic}
                  showCloseButton={canCloseAdsForUpsell}
                  onClose={handleAdClose}
                  className="rounded-xl overflow-hidden shadow-sm"
                />
              </div>

              {/* 底部右侧广告位 */}
              <div className="flex-1 flex items-center min-w-0">
                <AdBanner
                  position="bottom-right"
                  isDomestic={isDomestic}
                  showCloseButton={canCloseAdsForUpsell}
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

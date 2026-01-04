"use client";

import { useEffect, useCallback } from "react";
import { isMiniProgram, getWxMiniProgram } from "@/lib/wechat-mp";

/**
 * 微信小程序外部链接拦截器
 * 仅在微信小程序环境中拦截外部链接，通知小程序显示二维码弹窗
 */
export function MpLinkInterceptor() {
  // 判断是否为外部链接
  const isExternalUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    if (url.startsWith("javascript:")) return false;
    if (url.startsWith("#")) return false;
    if (url.startsWith("mailto:")) return false;
    if (url.startsWith("tel:")) return false;

    try {
      const link = new URL(url, window.location.href);
      return link.host !== window.location.host;
    } catch {
      return false;
    }
  }, []);

  // 发送消息给小程序
  const postToMiniProgram = useCallback((url: string) => {
    const mp = getWxMiniProgram();
    if (!mp) return;

    // 发送 postMessage
    if (typeof mp.postMessage === "function") {
      mp.postMessage({
        data: { type: "OPEN_EXTERNAL_URL", url },
      });
    }

    // 使用 reLaunch 触发 postMessage（postMessage 需要页面跳转才能被接收）
    if (typeof mp.navigateTo === "function") {
      // 跳转到当前页面触发消息发送
      mp.navigateTo({ url: "/pages/webshell/webshell" });
    }
  }, []);

  useEffect(() => {
    // 仅在微信小程序环境中启用拦截
    if (!isMiniProgram()) {
      console.log("[mp-link-interceptor] 非小程序环境，跳过");
      return;
    }

    console.log("[mp-link-interceptor] 外部链接拦截器已启动");

    // 拦截所有链接点击
    const handleClick = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;

      // 向上查找 <a> 标签
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      const href = anchor.href;

      if (!href) return;

      // 检查是否为外部链接
      if (isExternalUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        console.log("[mp-link-interceptor] 拦截外部链接:", href);
        postToMiniProgram(href);
      }
    };

    // 使用捕获阶段拦截
    document.addEventListener("click", handleClick, true);

    // 拦截 window.open
    const originalOpen = window.open;
    window.open = function (url?: string | URL, ...args) {
      const urlStr = url?.toString() || "";
      if (isExternalUrl(urlStr)) {
        console.log("[mp-link-interceptor] 拦截 window.open:", urlStr);
        postToMiniProgram(urlStr);
        return null;
      }
      return originalOpen.call(this, url, ...args);
    };

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.open = originalOpen;
    };
  }, [isExternalUrl, postToMiniProgram]);

  // 此组件不渲染任何内容
  return null;
}

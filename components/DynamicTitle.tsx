"use client";

import { useEffect } from "react";
import { IS_DOMESTIC_VERSION } from "@/config";

const DOMESTIC_MOBILE_TITLE = "晨佑AI平台";
const MOBILE_BREAKPOINT = 768;

/**
 * 动态设置网页标题
 * 国内版移动端显示"晨佑AI平台"
 * 其他情况保持 metadata 中的默认标题
 */
export function DynamicTitle() {
  useEffect(() => {
    // 仅国内版需要处理
    if (!IS_DOMESTIC_VERSION) return;

    const updateTitle = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (isMobile) {
        document.title = DOMESTIC_MOBILE_TITLE;
      }
    };

    // 使用 requestAnimationFrame 确保在渲染完成后设置标题
    // 多次调用以覆盖其他可能的标题设置
    const setTitleWithDelay = () => {
      updateTitle();
      requestAnimationFrame(() => {
        updateTitle();
        // 再次延迟确保覆盖
        setTimeout(updateTitle, 100);
      });
    };

    // 立即执行
    setTitleWithDelay();

    // 监听窗口大小变化
    window.addEventListener("resize", updateTitle);
    return () => window.removeEventListener("resize", updateTitle);
  }, []);

  return null;
}

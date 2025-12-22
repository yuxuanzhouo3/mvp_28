"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

// 广告位置类型
export type AdPosition = "top" | "bottom" | "left" | "right" | "sidebar" | "bottom-left" | "bottom-right";

// 广告类型定义
export interface PublicAdvertisement {
  id: string;
  title: string;
  position: AdPosition;
  media_type: "image" | "video";
  media_url: string;
  target_url: string | null;
  priority: number;
}

export interface AdBannerProps {
  /** 广告位置：top（顶部）、bottom（底部）、left（左侧）、right（右侧）、sidebar（侧边栏）、bottom-left（底部左侧）、bottom-right（底部右侧） */
  position: AdPosition;
  /** 是否为国内版本 */
  isDomestic: boolean;
  /** 自定义类名 */
  className?: string;
  /** 广告刷新间隔（毫秒），默认不自动刷新 */
  refreshInterval?: number;
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean;
  /** 关闭后回调 */
  onClose?: () => void;
  /** 广告点击回调 */
  onAdClick?: (ad: PublicAdvertisement) => void;
  /** 没有广告时是否显示占位符（用于调试） */
  showPlaceholder?: boolean;
}

/**
 * 通用广告横幅组件
 * 支持图片和视频广告，自动根据国内外版本获取对应数据源的广告
 */
export default function AdBanner({
  position,
  isDomestic,
  className = "",
  refreshInterval,
  showCloseButton = false,
  onClose,
  onAdClick,
}: AdBannerProps) {
  const [ads, setAds] = useState<PublicAdvertisement[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [, setError] = useState<string | null>(null);

  // 加载广告
  const loadAds = useCallback(async () => {
    try {
      setError(null);
      // 使用 fetch API 调用后端接口
      const response = await fetch(
        `/api/ads/active?position=${position}&isDomestic=${isDomestic}`
      );
      const result = await response.json();

      console.log(`[AdBanner] position="${position}", isDomestic=${isDomestic}, response:`, result);

      if (result.success && result.data && result.data.length > 0) {
        console.log(`[AdBanner] Setting ${result.data.length} ads for position="${position}":`, result.data);
        setAds(result.data);
        setCurrentAdIndex(0);
      } else {
        console.log(`[AdBanner] No ads found for position="${position}"`);
        setAds([]);
      }
    } catch (err) {
      console.error("AdBanner loadAds error:", err);
      setError("加载广告失败");
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [position, isDomestic]);

  // 初始加载
  useEffect(() => {
    console.log(`[AdBanner] Component mounted for position="${position}"`);
    loadAds();
  }, [loadAds]);

  // 自动刷新
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      loadAds();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [refreshInterval, loadAds]);

  // 多广告轮播（如果有多个广告）
  useEffect(() => {
    if (ads.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, 5000); // 每5秒切换

    return () => clearInterval(timer);
  }, [ads.length]);

  // 处理关闭
  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  // 处理广告点击
  const handleAdClick = (ad: PublicAdvertisement) => {
    onAdClick?.(ad);
    if (ad.target_url) {
      window.open(ad.target_url, "_blank", "noopener,noreferrer");
    }
  };

  // 如果已关闭，不渲染
  if (!visible) {
    console.log(`[AdBanner] position="${position}" is not visible (closed)`);
    return null;
  }

  // 加载中或没有广告时的处理
  if (loading) {
    // 可以显示加载状态，但为了美观这里直接返回 null
    console.log(`[AdBanner] position="${position}" is still loading`);
    return null;
  }

  // 没有广告数据时不渲染（广告需要在后台管理系统中添加）
  if (ads.length === 0) {
    console.log(`[AdBanner] position="${position}" has no ads data`);
    return null;
  }

  const currentAd = ads[currentAdIndex];
  console.log(`[AdBanner] Rendering position="${position}" with ad:`, currentAd);

  // 顶部广告样式 - 固定高度，填满宽度，圆角，仅桌面端显示
  const topAdStyles = `
    flex items-center justify-center
    h-[36px] w-full overflow-hidden
    hidden lg:flex
    rounded-lg
  `;

  // 底部广告样式 - 更紧凑，横向填满
  const bottomAdStyles = `
    flex items-center justify-center
    mt-2 h-[60px]
    bg-transparent
  `;

  // 左右侧广告样式 - 高度固定170px，宽度弹性填充
  const sideAdStyles = `
    flex items-center justify-center
    w-full h-[170px] max-h-[170px] overflow-hidden
  `;

  // 底部左右广告样式 - 高度与底部广告一致(60px)，宽度弹性填充
  const bottomSideAdStyles = `
    flex items-center justify-center
    w-full h-[60px] max-h-[60px] overflow-hidden
  `;

  // 侧边栏广告样式 - 竖向长条，增加纵向长度，图片拉伸填充
  const sidebarAdStyles = `
    flex items-center justify-center
    w-7 h-[400px] overflow-hidden
  `;

  const isTop = position === "top";
  const isSideAd = position === "left" || position === "right";
  const isBottomSideAd = position === "bottom-left" || position === "bottom-right";

  // 获取位置对应的样式
  const getPositionStyles = () => {
    switch (position) {
      case "top":
        return topAdStyles;
      case "bottom":
        return bottomAdStyles;
      case "left":
      case "right":
        return sideAdStyles;
      case "bottom-left":
      case "bottom-right":
        return bottomSideAdStyles;
      case "sidebar":
        return sidebarAdStyles;
      default:
        return bottomAdStyles;
    }
  };

  return (
    <div
      className={`
        relative
        ${getPositionStyles()}
        ${className}
      `}
      role="banner"
      aria-label={`${position} advertisement`}
    >
      {/* 广告内容 */}
      <button
        type="button"
        onClick={() => handleAdClick(currentAd)}
        className="block cursor-pointer w-full h-full transition-opacity duration-300 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        title={currentAd.target_url ? `点击访问: ${currentAd.title}` : currentAd.title}
      >
        {currentAd.media_type === "image" ? (
          <img
            src={currentAd.media_url}
            alt={currentAd.title}
            className={`w-full h-full object-fill ${isSideAd || isBottomSideAd ? "rounded-xl" : !isTop ? "rounded-lg" : ""}`}
            loading="lazy"
          />
        ) : (
          <video
            src={currentAd.media_url}
            className={`w-full h-full object-fill ${isSideAd || isBottomSideAd ? "rounded-xl" : !isTop ? "rounded-lg" : ""}`}
            autoPlay
            muted
            loop
            playsInline
          />
        )}
      </button>

      {/* 关闭按钮 */}
      {showCloseButton && (
        <button
          type="button"
          onClick={handleClose}
          className={`
            absolute
            ${isTop ? "right-0 top-1/2 -translate-y-1/2" : "right-2 top-2"}
            p-1 rounded-full
            bg-black/30 hover:bg-black/50
            text-white
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-white
          `}
          aria-label="关闭广告"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* 多广告指示器（仅底部广告显示） */}
      {position === "bottom" && ads.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {ads.map((_, index) => (
            <span
              key={index}
              className={`
                w-1.5 h-1.5 rounded-full
                transition-colors duration-200
                ${index === currentAdIndex ? "bg-white" : "bg-white/50"}
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useIsMobile } from "@/hooks";
import { IS_DOMESTIC_VERSION } from "@/config";

const DOMESTIC_MOBILE_TITLE = "晨佑AI平台";
const DEFAULT_TITLE = "MornGPT";

/**
 * 动态设置网页标题
 * 国内版移动端显示"晨佑AI平台"，其他情况显示"MornGPT"
 */
export function DynamicTitle() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (IS_DOMESTIC_VERSION && isMobile) {
      document.title = DOMESTIC_MOBILE_TITLE;
    } else {
      document.title = DEFAULT_TITLE;
    }
  }, [isMobile]);

  return null;
}

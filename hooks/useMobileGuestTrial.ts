/**
 * 移动端访客试用 Hook
 *
 * 功能：
 * - 仅在国内版（NEXT_PUBLIC_DEFAULT_LANGUAGE=zh）移动端生效
 * - 允许未登录用户进行免费10轮【General Model】模型的对话
 * - 对话轮数用完后弹出登录弹窗
 * - 不影响国际版和电脑端的任何逻辑
 */

import { useState, useCallback, useEffect } from "react";
import { IS_DOMESTIC_VERSION } from "@/config";

const MOBILE_GUEST_TRIAL_KEY = "morngpt_mobile_guest_trial";
const MAX_TRIAL_ROUNDS = 10;

interface MobileGuestTrialState {
  usedRounds: number;
  lastResetDate: string;
}

export const useMobileGuestTrial = (isMobile: boolean) => {
  const [trialState, setTrialState] = useState<MobileGuestTrialState>({
    usedRounds: 0,
    lastResetDate: new Date().toDateString(),
  });

  // 仅在国内版移动端生效
  const isEnabled = IS_DOMESTIC_VERSION && isMobile;

  // 从 localStorage 加载试用状态
  useEffect(() => {
    if (!isEnabled) return;

    try {
      const stored = localStorage.getItem(MOBILE_GUEST_TRIAL_KEY);
      if (stored) {
        const parsed: MobileGuestTrialState = JSON.parse(stored);
        const today = new Date().toDateString();

        // 如果是新的一天，重置试用次数
        if (parsed.lastResetDate !== today) {
          const newState = { usedRounds: 0, lastResetDate: today };
          setTrialState(newState);
          localStorage.setItem(MOBILE_GUEST_TRIAL_KEY, JSON.stringify(newState));
        } else {
          setTrialState(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load mobile guest trial state:", e);
    }
  }, [isEnabled]);

  // 检查是否还有试用次数
  const hasTrialRemaining = useCallback(() => {
    if (!isEnabled) return false;
    return trialState.usedRounds < MAX_TRIAL_ROUNDS;
  }, [isEnabled, trialState.usedRounds]);

  // 获取剩余试用次数
  const getRemainingTrials = useCallback(() => {
    if (!isEnabled) return 0;
    return Math.max(0, MAX_TRIAL_ROUNDS - trialState.usedRounds);
  }, [isEnabled, trialState.usedRounds]);

  // 消耗一次试用
  const consumeTrial = useCallback(() => {
    if (!isEnabled) return false;
    if (trialState.usedRounds >= MAX_TRIAL_ROUNDS) return false;

    const newState = {
      usedRounds: trialState.usedRounds + 1,
      lastResetDate: trialState.lastResetDate,
    };
    setTrialState(newState);

    try {
      localStorage.setItem(MOBILE_GUEST_TRIAL_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error("Failed to save mobile guest trial state:", e);
    }

    return true;
  }, [isEnabled, trialState]);

  // 重置试用状态（主要用于测试）
  const resetTrial = useCallback(() => {
    if (!isEnabled) return;

    const newState = {
      usedRounds: 0,
      lastResetDate: new Date().toDateString(),
    };
    setTrialState(newState);

    try {
      localStorage.setItem(MOBILE_GUEST_TRIAL_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error("Failed to reset mobile guest trial state:", e);
    }
  }, [isEnabled]);

  return {
    isEnabled,
    hasTrialRemaining,
    getRemainingTrials,
    consumeTrial,
    resetTrial,
    usedRounds: trialState.usedRounds,
    maxRounds: MAX_TRIAL_ROUNDS,
  };
};

/**
 * 访客试用 Hook
 *
 * 功能：
 * - 同时支持国内版和国际版
 * - 允许未登录用户进行免费对话（次数由 NEXT_PUBLIC_TRIAL_DAILY_LIMIT 环境变量控制，默认10轮）
 * - 对话轮数用完后弹出登录弹窗
 * - 同时支持移动端和桌面端
 */

import { useState, useCallback, useEffect } from "react";

const GUEST_TRIAL_KEY = "morngpt_guest_trial";

// 从环境变量读取试用次数限制，默认为 10
const MAX_TRIAL_ROUNDS = (() => {
  const raw = process.env.NEXT_PUBLIC_TRIAL_DAILY_LIMIT || "10";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(100, n); // 安全上限
})();

interface GuestTrialState {
  usedRounds: number;
  lastResetDate: string;
}

// 保持原有函数签名兼容性，isMobile 参数现在被忽略
export const useMobileGuestTrial = (_isMobile?: boolean) => {
  const [trialState, setTrialState] = useState<GuestTrialState>({
    usedRounds: 0,
    lastResetDate: new Date().toDateString(),
  });

  // 同时支持国内版和国际版
  const isEnabled = true;

  // 从 localStorage 加载试用状态
  useEffect(() => {
    if (!isEnabled) return;

    try {
      const stored = localStorage.getItem(GUEST_TRIAL_KEY);
      if (stored) {
        const parsed: GuestTrialState = JSON.parse(stored);
        const today = new Date().toDateString();

        // 如果是新的一天，重置试用次数
        if (parsed.lastResetDate !== today) {
          const newState = { usedRounds: 0, lastResetDate: today };
          setTrialState(newState);
          localStorage.setItem(GUEST_TRIAL_KEY, JSON.stringify(newState));
        } else {
          setTrialState(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load guest trial state:", e);
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
      localStorage.setItem(GUEST_TRIAL_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error("Failed to save guest trial state:", e);
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
      localStorage.setItem(GUEST_TRIAL_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error("Failed to reset guest trial state:", e);
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

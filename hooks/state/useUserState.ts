import { useState } from "react";
import type { AppUser, ChatSession, UserSettings } from "../../types";
import { DEFAULT_LANGUAGE, IS_DOMESTIC_VERSION } from "../../config";

export const useUserState = () => {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    theme: "light",
    language: DEFAULT_LANGUAGE,
    notifications: true,
    soundEnabled: true,
    autoSave: true,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [userProfileForm, setUserProfileForm] = useState({
    name: "",
    email: "",
    bio: "",
  });
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [customShortcuts, setCustomShortcuts] =
    useState<Record<string, string>>({});
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(true);
  const [nextBillingDate, setNextBillingDate] = useState("2024-12-25");
  const [paymentMethod, setPaymentMethod] = useState({
    type: "card",
    last4: "4242",
    brand: "Visa",
    expiry: "12/25",
  });
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">(
    "login"
  );
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [selectedBookmarkFolder, setSelectedBookmarkFolder] =
    useState<string>("default");
  const [editingShortcutValue, setEditingShortcutValue] = useState<string>("");
  const [shortcutConflict, setShortcutConflict] = useState<{
    shortcut: string;
    conflictingAction: string;
  } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>(IS_DOMESTIC_VERSION ? "alipay" : "stripe");
  const [currentPlan, setCurrentPlan] =
    useState<"Basic" | "Pro" | "Enterprise" | null>(null);
  const [guestChatSessions, setGuestChatSessions] = useState<ChatSession[]>([]);
  const [guestSessionTimeout, setGuestSessionTimeout] =
    useState<NodeJS.Timeout | null>(null);

  return {
    appUser,
    setAppUser,
    isLoggedIn,
    setIsLoggedIn,
    userSettings,
    setUserSettings,
    isEditingProfile,
    setIsEditingProfile,
    userProfileForm,
    setUserProfileForm,
    editingShortcut,
    setEditingShortcut,
    customShortcuts,
    setCustomShortcuts,
    autoRenewEnabled,
    setAutoRenewEnabled,
    nextBillingDate,
    setNextBillingDate,
    paymentMethod,
    setPaymentMethod,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    showPassword,
    setShowPassword,
    promptHistory,
    setPromptHistory,
    selectedBookmarkFolder,
    setSelectedBookmarkFolder,
    editingShortcutValue,
    setEditingShortcutValue,
    shortcutConflict,
    setShortcutConflict,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    currentPlan,
    setCurrentPlan,
    guestChatSessions,
    setGuestChatSessions,
    guestSessionTimeout,
    setGuestSessionTimeout,
  };
};

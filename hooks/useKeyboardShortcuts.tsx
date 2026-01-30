import { useState, useCallback } from "react";
import { useIsIOSMobile } from "@/hooks";

export interface Shortcut {
  action: string;
  current: string;
}

export interface ShortcutConflict {
  shortcut: string;
  conflictingAction: string;
}

export const useKeyboardShortcuts = (
  shortcutsEnabled: boolean,
  appUser: any,
  customShortcuts: Record<string, string>,
  setCustomShortcuts: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  // Action handlers
  createNewChat: () => void,
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>,
  toggleTheme: () => void,
  setShowSettingsDialog: (show: boolean) => void,
  setShowBillingDialog: (show: boolean) => void,
  setShowPrivacyDialog: (show: boolean) => void,
  setShowDownloadSection: React.Dispatch<React.SetStateAction<boolean>>,
  setShowShortcutsHelp: (show: boolean) => void,
  setIsAskGPTOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setIsPromptHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>,
  toggleVoiceRecording: () => void,
  toggleCamera: () => void,
  getCurrentLocation: () => void,
  handleQuickAction: (action: string) => void,
  deleteChat: (chatId: string) => void,
  currentChatId: string,
  messagesEndRef: React.RefObject<HTMLDivElement | null>,
  scrollToInputArea: () => void
) => {
  const isIOSMobile = useIsIOSMobile();
  const [editingShortcut, setEditingShortcut] = useState("");
  const [editingShortcutValue, setEditingShortcutValue] = useState("");
  const [shortcutConflict, setShortcutConflict] =
    useState<ShortcutConflict | null>(null);

  const getDefaultShortcut = (action: string) => {
    const defaultShortcuts: Record<string, string> = {
      "New Chat": "Ctrl/Cmd + K",
      "Search Chats": "Ctrl/Cmd + F",
      "Toggle Sidebar": "Ctrl/Cmd + B",
      Settings: "Ctrl/Cmd + S",
      "Toggle Theme": "Ctrl/Cmd + D",
      "Ask GPT": "Ctrl/Cmd + G",
      Downloads: "Ctrl/Cmd + Shift + D",
      "Hotkeys Menu": "Ctrl/Cmd + H",
      "Open Billing": "Ctrl/Cmd + Q",
      "Open Privacy": "Ctrl/Cmd + Y",
      "Close Dialogs": "Ctrl/Cmd + I",
      "Deep Thinking": "Ctrl/Cmd + 1",
      "Creative Ideas": "Ctrl/Cmd + 2",
      Analyze: "Ctrl/Cmd + 3",
      "Problem Solve": "Ctrl/Cmd + 4",
      "Send Prompt": "Enter",
      "Jump to Last": "Ctrl/Cmd + J",
      "Jump to Top": "Ctrl/Cmd + T",
      "Upload Files": "Ctrl/Cmd + U",
      "Voice Input": "Ctrl/Cmd + R",
      "Camera Input": "Ctrl/Cmd + C",
      "Location Input": "Ctrl/Cmd + L",
      "Prompt History": "Ctrl/Cmd + P",
      "Billing Management": "Ctrl/Cmd + M",
      "Payment History": "Ctrl/Cmd + I",
      "Update Payment": "Ctrl/Cmd + O",
      "Cancel Subscription": "Ctrl/Cmd + X",
      "Download Invoice": "Ctrl/Cmd + V",
      "Privacy Settings": "Ctrl/Cmd + Y",
      "Data Export": "Ctrl/Cmd + E",
      "Delete Account": "Ctrl/Cmd + Delete",
      "Cookie Settings": "Ctrl/Cmd + C",
      "Security Settings": "Ctrl/Cmd + Z",
      "Export Hotkeys": "Ctrl/Cmd + Shift + E",
    };
    return defaultShortcuts[action] || "";
  };

  const getShortcutValue = (action: string, defaultValue: string) => {
    return customShortcuts[action] || defaultValue;
  };

  const findShortcutConflict = (newShortcut: string, currentAction: string) => {
    // Get all default shortcuts
    const allShortcuts = [
      { action: "New Chat", current: "Ctrl/Cmd + K" },
      { action: "Search Chats", current: "Ctrl/Cmd + F" },
      { action: "Toggle Sidebar", current: "Ctrl/Cmd + B" },
      { action: "Settings", current: "Ctrl/Cmd + S" },
      { action: "Toggle Theme", current: "Ctrl/Cmd + D" },
      { action: "Ask GPT", current: "Ctrl/Cmd + G" },
      { action: "Downloads", current: "Ctrl/Cmd + Shift + D" },
      { action: "Hotkeys Menu", current: "Ctrl/Cmd + H" },
      { action: "Open Billing", current: "Ctrl/Cmd + Q" },
      { action: "Open Privacy", current: "Ctrl/Cmd + Y" },
      { action: "Close Dialogs", current: "Ctrl/Cmd + I" },
      { action: "Deep Thinking", current: "Ctrl/Cmd + 1" },
      { action: "Creative Ideas", current: "Ctrl/Cmd + 2" },
      { action: "Analyze", current: "Ctrl/Cmd + 3" },
      { action: "Problem Solve", current: "Ctrl/Cmd + 4" },
      { action: "Send Prompt", current: "Enter" },
      { action: "Jump to Last", current: "Ctrl/Cmd + J" },
      { action: "Jump to Top", current: "Ctrl/Cmd + T" },
      { action: "Upload Files", current: "Ctrl/Cmd + U" },
      { action: "Voice Input", current: "Ctrl/Cmd + R" },
      { action: "Camera Input", current: "Ctrl/Cmd + C" },
      { action: "Location Input", current: "Ctrl/Cmd + L" },
      { action: "Prompt History", current: "Ctrl/Cmd + P" },
      { action: "Billing Management", current: "Ctrl/Cmd + M" },
      { action: "Payment History", current: "Ctrl/Cmd + I" },
      { action: "Update Payment", current: "Ctrl/Cmd + O" },
      { action: "Cancel Subscription", current: "Ctrl/Cmd + X" },
      { action: "Download Invoice", current: "Ctrl/Cmd + V" },
      { action: "Privacy Settings", current: "Ctrl/Cmd + Y" },
      { action: "Data Export", current: "Ctrl/Cmd + E" },
      { action: "Delete Account", current: "Ctrl/Cmd + Delete" },
      { action: "Cookie Settings", current: "Ctrl/Cmd + C" },
      { action: "Security Settings", current: "Ctrl/Cmd + Z" },
      { action: "Export Hotkeys", current: "Ctrl/Cmd + Shift + E" },
    ];

    // Check against default shortcuts
    for (const shortcut of allShortcuts) {
      if (
        shortcut.action !== currentAction &&
        shortcut.current === newShortcut
      ) {
        return shortcut.action;
      }
    }

    // Check against custom shortcuts
    for (const [action, customShortcut] of Object.entries(customShortcuts)) {
      if (action !== currentAction && customShortcut === newShortcut) {
        return action;
      }
    }

    return null;
  };

  const checkShortcutMatch = useCallback(
    (e: React.KeyboardEvent, action: string) => {
      // Get the current shortcut for this action (custom or default)
      const currentShortcut = getShortcutValue(
        action,
        getDefaultShortcut(action)
      );

      if (!currentShortcut) {
        return false;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Parse the shortcut string (e.g., "Ctrl/Cmd + K")
      const parts = currentShortcut.split(" + ");

      // Check modifiers
      if (parts.includes("Ctrl") || parts.includes("Cmd")) {
        if (!cmdOrCtrl) return false;
      }
      if (parts.includes("Shift")) {
        if (!e.shiftKey) return false;
      }
      if (parts.includes("Alt")) {
        if (!e.altKey) return false;
      }

      // Check the main key
      const mainKey = parts[parts.length - 1];
      if (mainKey === "Escape") {
        return e.key === "Escape";
      } else if (mainKey === "Enter") {
        return e.key === "Enter";
      } else if (mainKey === "Space") {
        return e.key === " ";
      } else if (mainKey === "Tab") {
        return e.key === "Tab";
      } else if (mainKey.startsWith("F") && mainKey.length > 1) {
        // Function keys
        return e.key === mainKey;
      } else if (mainKey === "↑") {
        return e.key === "ArrowUp";
      } else if (mainKey === "↓") {
        return e.key === "ArrowDown";
      } else if (mainKey === "←") {
        return e.key === "ArrowLeft";
      } else if (mainKey === "→") {
        return e.key === "ArrowRight";
      } else {
        // Regular keys
        return e.key.toLowerCase() === mainKey.toLowerCase();
      }
    },
    [customShortcuts]
  );

  const handleGlobalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only handle shortcuts if they're enabled and user is logged in
      if (!shortcutsEnabled || !appUser) {
        return;
      }

      // Prevent shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Open Billing Management
      if (checkShortcutMatch(e, "Open Billing")) {
        setShowBillingDialog(true);
        return;
      }

      // Open Privacy Settings
      if (checkShortcutMatch(e, "Open Privacy")) {
        setShowPrivacyDialog(true);
        return;
      }

      // Navigation shortcuts
      if (checkShortcutMatch(e, "New Chat")) {
        e.preventDefault();
        createNewChat();
      }

      if (checkShortcutMatch(e, "Search Chats")) {
        e.preventDefault();
        // Focus search in sidebar
        const searchInput = document.querySelector(
          'input[placeholder="Search chats..."]'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Model selection shortcuts
      if (checkShortcutMatch(e, "Deep Thinking")) {
        e.preventDefault();
        handleQuickAction("deep-thinking");
      }

      if (checkShortcutMatch(e, "Creative Ideas")) {
        e.preventDefault();
        handleQuickAction("creative");
      }

      if (checkShortcutMatch(e, "Analyze")) {
        e.preventDefault();
        handleQuickAction("analyze");
      }

      if (checkShortcutMatch(e, "Problem Solve")) {
        e.preventDefault();
        handleQuickAction("solve");
      }

      // UI shortcuts
      if (checkShortcutMatch(e, "Toggle Sidebar")) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }

      if (checkShortcutMatch(e, "Toggle Theme")) {
        e.preventDefault();
        toggleTheme();
      }

      if (checkShortcutMatch(e, "Settings")) {
        e.preventDefault();
        setShowSettingsDialog(true);
      }

      // Chat management shortcuts
      if (cmdOrCtrl && e.key === "w") {
        e.preventDefault();
        if (currentChatId !== "1") {
          deleteChat(currentChatId);
        }
      }

      // Message shortcuts
      if (checkShortcutMatch(e, "Jump to Last")) {
        e.preventDefault();
        // Jump to last message
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }

      if (checkShortcutMatch(e, "Jump to Top")) {
        e.preventDefault();
        // Jump to top of chat
        const chatContainer = document.querySelector(
          ".scroll-area"
        ) as HTMLElement;
        if (chatContainer) {
          chatContainer.scrollTo({ top: 0, behavior: "smooth" });
        }
      }

      // File upload shortcut
      if (checkShortcutMatch(e, "Upload Files")) {
        e.preventDefault();
        document.getElementById("file-upload")?.click();
      }

      // Voice input shortcut
      if (checkShortcutMatch(e, "Voice Input")) {
        e.preventDefault();
        toggleVoiceRecording();
      }

      // Camera input shortcut
      if (checkShortcutMatch(e, "Camera Input")) {
        e.preventDefault();
        toggleCamera();
      }

      // Location input shortcut
      if (checkShortcutMatch(e, "Location Input")) {
        e.preventDefault();
        getCurrentLocation();
      }

      // Downloads shortcut
      if (checkShortcutMatch(e, "Downloads")) {
        e.preventDefault();
        if (!isIOSMobile) {
          setShowDownloadSection(true);
        }
      }

      // Ask GPT shortcut
      if (checkShortcutMatch(e, "Ask GPT")) {
        e.preventDefault();
        setIsAskGPTOpen((prev) => !prev);
      }

      // Prompt History shortcut
      if (checkShortcutMatch(e, "Prompt History")) {
        e.preventDefault();
        setIsPromptHistoryOpen(true);
      }

      // Hotkeys menu shortcut
      if (checkShortcutMatch(e, "Hotkeys Menu")) {
        e.preventDefault();
        setShowShortcutsHelp(true);
      }

      // Ask GPT shortcut
      if (cmdOrCtrl && e.key === "g") {
        e.preventDefault();
        setIsAskGPTOpen((prev) => !prev);
      }

      // Bookmarks shortcut
      if (cmdOrCtrl && e.key === "m") {
        e.preventDefault();
        // Toggle bookmarks view
        console.log("Toggle bookmarks - implement as needed");
      }

      // Download shortcut
      if (cmdOrCtrl && e.key === "j") {
        e.preventDefault();
        if (!isIOSMobile) {
          setShowDownloadSection((prev) => !prev);
        }
      }

      // Help shortcut
      if (cmdOrCtrl && e.key === "/") {
        e.preventDefault();
        setShowShortcutsHelp(true);
      }

      // Escape key to close dialogs
      if (checkShortcutMatch(e, "Close Dialogs")) {
        // This will be handled by the parent component
      }
    },
    [
      shortcutsEnabled,
      appUser,
      checkShortcutMatch,
      createNewChat,
      setSidebarCollapsed,
      toggleTheme,
      setShowSettingsDialog,
      setShowBillingDialog,
      setShowPrivacyDialog,
      setShowDownloadSection,
      setShowShortcutsHelp,
      setIsAskGPTOpen,
      setIsPromptHistoryOpen,
      toggleVoiceRecording,
      toggleCamera,
      getCurrentLocation,
      handleQuickAction,
      deleteChat,
      currentChatId,
      messagesEndRef,
    ]
  );

  const startEditingShortcut = useCallback(
    (action: string, currentValue: string) => {
      setEditingShortcut(action);
      setEditingShortcutValue(currentValue);
      setShortcutConflict(null);
    },
    []
  );

  const saveShortcut = useCallback((action: string) => {
    setEditingShortcut("");
    setEditingShortcutValue("");
    setShortcutConflict(null);
  }, []);

  const resetToDefaults = useCallback(() => {
    setCustomShortcuts({});
    localStorage.removeItem("customShortcuts");
  }, [setCustomShortcuts]);

  const resetNavigationShortcuts = useCallback(() => {
    const navigationActions = [
      "New Chat",
      "Search Chats",
      "Toggle Sidebar",
      "Settings",
      "Toggle Theme",
      "Ask GPT",
      "Downloads",
      "Hotkeys Menu",
      "Close Dialogs",
    ];
    const newShortcuts = { ...customShortcuts };
    navigationActions.forEach((action) => {
      delete newShortcuts[action];
    });
    setCustomShortcuts(newShortcuts);
    localStorage.setItem("customShortcuts", JSON.stringify(newShortcuts));
  }, [customShortcuts, setCustomShortcuts]);

  const resetAIModelShortcuts = useCallback(() => {
    const aiModelActions = [
      "Deep Thinking",
      "Creative Ideas",
      "Analyze",
      "Problem Solve",
    ];
    const newShortcuts = { ...customShortcuts };
    aiModelActions.forEach((action) => {
      delete newShortcuts[action];
    });
    setCustomShortcuts(newShortcuts);
    localStorage.setItem("customShortcuts", JSON.stringify(newShortcuts));
  }, [customShortcuts, setCustomShortcuts]);

  const resetPromptsShortcuts = useCallback(() => {
    const promptsActions = [
      "Send Prompt",
      "Jump to Last",
      "Jump to Top",
      "Upload Files",
      "Voice Input",
      "Camera Input",
      "Location Input",
      "Prompt History",
    ];
    const newShortcuts = { ...customShortcuts };
    promptsActions.forEach((action) => {
      delete newShortcuts[action];
    });
    setCustomShortcuts(newShortcuts);
    localStorage.setItem("customShortcuts", JSON.stringify(newShortcuts));
  }, [customShortcuts, setCustomShortcuts]);

  const resetBillingShortcuts = useCallback(() => {
    const billingActions = [
      "Billing Management",
      "Payment History",
      "Update Payment",
      "Cancel Subscription",
      "Download Invoice",
    ];
    const newShortcuts = { ...customShortcuts };
    billingActions.forEach((action) => {
      delete newShortcuts[action];
    });
    setCustomShortcuts(newShortcuts);
    localStorage.setItem("customShortcuts", JSON.stringify(newShortcuts));
  }, [customShortcuts, setCustomShortcuts]);

  const resetPrivacyShortcuts = useCallback(() => {
    const privacyActions = [
      "Privacy Settings",
      "Data Export",
      "Delete Account",
      "Cookie Settings",
      "Security Settings",
    ];
    const newShortcuts = { ...customShortcuts };
    privacyActions.forEach((action) => {
      delete newShortcuts[action];
    });
    setCustomShortcuts(newShortcuts);
    localStorage.setItem("customShortcuts", JSON.stringify(newShortcuts));
  }, [customShortcuts, setCustomShortcuts]);

  const exportHotkeys = useCallback(() => {
    const exportData = {
      customShortcuts,
      userSettings: appUser?.settings,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mornGPT-hotkeys-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [customShortcuts, appUser]);

  const importHotkeys = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importData = JSON.parse(event.target?.result as string);
            if (importData.customShortcuts) {
              setCustomShortcuts(importData.customShortcuts);
              localStorage.setItem(
                "customShortcuts",
                JSON.stringify(importData.customShortcuts)
              );
            }
            if (importData.userSettings) {
              // This would need to be passed as a callback
              // updateUserSettings(importData.userSettings);
            }
            // Show success message
            alert("Hotkeys imported successfully!");
          } catch (error) {
            alert("Error importing hotkeys. Please check the file format.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [setCustomShortcuts]);

  const renderShortcutDisplay = useCallback(
    (shortcut: Shortcut) => {
      const isEditing = editingShortcut === shortcut.action;
      const currentValue = isEditing
        ? editingShortcutValue
        : getShortcutValue(shortcut.action, shortcut.current);

      return (
        <div className="relative group">
          <kbd
            className={`px-2 py-1 text-[10px] rounded cursor-pointer transition-colors ${
              isEditing
                ? "bg-blue-100 dark:bg-blue-900 border border-blue-500 opacity-0"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 hover:border hover:border-blue-500"
            }`}
            title="Click or hover to edit"
            onClick={() => {
              startEditingShortcut(
                shortcut.action,
                getShortcutValue(shortcut.action, shortcut.current)
              );
            }}
          >
            {getShortcutValue(shortcut.action, shortcut.current)}
          </kbd>
          <input
            type="text"
            className={`absolute inset-0 px-2 py-1 text-[10px] bg-blue-100 dark:bg-blue-900 border border-blue-500 rounded transition-opacity duration-200 ${
              isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            value={currentValue}
            onChange={(e) => setEditingShortcutValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveShortcut(shortcut.action);
              } else if (e.key === "Escape") {
                setEditingShortcut("");
                setEditingShortcutValue("");
                setShortcutConflict(null);
              }
            }}
            onBlur={() => saveShortcut(shortcut.action)}
            onMouseEnter={(e) => {
              e.currentTarget.focus();
              startEditingShortcut(
                shortcut.action,
                getShortcutValue(shortcut.action, shortcut.current)
              );
            }}
            onClick={() => {
              startEditingShortcut(
                shortcut.action,
                getShortcutValue(shortcut.action, shortcut.current)
              );
            }}
          />
        </div>
      );
    },
    [
      editingShortcut,
      editingShortcutValue,
      getShortcutValue,
      startEditingShortcut,
      saveShortcut,
    ]
  );

  return {
    editingShortcut,
    editingShortcutValue,
    shortcutConflict,
    handleGlobalKeyDown,
    startEditingShortcut,
    saveShortcut,
    resetToDefaults,
    resetNavigationShortcuts,
    resetAIModelShortcuts,
    resetPromptsShortcuts,
    resetBillingShortcuts,
    resetPrivacyShortcuts,
    exportHotkeys,
    importHotkeys,
    renderShortcutDisplay,
    getDefaultShortcut,
    getShortcutValue,
    findShortcutConflict,
  };
};

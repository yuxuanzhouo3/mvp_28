import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ModalHub from "@/features/chat/components/ModalHub";
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
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#2d2d30] text-gray-900 dark:text-[#ececf1] flex">
      <Sidebar {...sidebarProps} />

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

        {/* Input Area - Fixed at bottom */}
        <InputAreaComponent {...inputAreaProps} />
      </div>

      <ModalHub {...modalProps} />
    </div>
  );
}

export default ChatShell;

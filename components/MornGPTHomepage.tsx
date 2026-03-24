"use client";

import React from "react";
import ChatProvider from "@/features/chat/providers/ChatProvider";
import { ChatShell } from "@/features/chat/components";

export default function MornGPTHomepage() {
  return (
    <ChatProvider>
      <ChatShell />
    </ChatProvider>
  );
}

"use client";

import React from "react";
import ProUpgradeDialogClient from "./ProUpgradeDialogClient";

interface ProUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "voice" | "video" | null;
  trialCount: number;
  maxTrials: number;
  onMaybeLater: () => void;
  onUpgrade: () => void;
}

export default function ProUpgradeDialog(props: ProUpgradeDialogProps) {
  return <ProUpgradeDialogClient {...props} />;
}

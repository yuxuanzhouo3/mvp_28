import { useState } from "react";

export const useResetState = () => {
  const [resetConfirmData, setResetConfirmData] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [registrationPromptType, setRegistrationPromptType] = useState<
    "paid_model" | "general" | "feature" | null
  >(null);

  return {
    resetConfirmData,
    setResetConfirmData,
    registrationPromptType,
    setRegistrationPromptType,
  };
};

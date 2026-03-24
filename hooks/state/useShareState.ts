import { useState } from "react";

export const useShareState = () => {
  const [shareLink, setShareLink] = useState("");
  const [shareSecret, setShareSecret] = useState("");

  return {
    shareLink,
    setShareLink,
    shareSecret,
    setShareSecret,
  };
};

import { useState } from "react";

export const usePaymentState = () => {
  const [paymentError, setPaymentError] = useState<{
    currentUsage: number;
    limit: number;
    modelName: string;
  } | null>(null);

  return {
    paymentError,
    setPaymentError,
  };
};

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

export default function PayPalSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [message, setMessage] = useState("Processing your payment...");

  useEffect(() => {
    const token = searchParams.get("token"); // PayPal returns token=orderId
    if (!token) {
      setStatus("error");
      setMessage("Missing PayPal token.");
      return;
    }

    const confirm = async () => {
      try {
        const res = await fetch("/api/payment/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: token }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "PayPal capture failed");
        }

        // Mark user as Pro locally (client-side persistence)
        try {
          const stored = localStorage.getItem("morngpt_user");
          if (stored) {
            const user = JSON.parse(stored);
            user.isPro = true;
            user.isPaid = true;
            if (data.plan) user.plan = data.plan;
            if (data.expiresAt) user.planExp = data.expiresAt;
            localStorage.setItem("morngpt_user", JSON.stringify(user));
          }
          if (data.plan) {
            localStorage.setItem("morngpt_current_plan", data.plan);
            if (data.expiresAt) {
              localStorage.setItem("morngpt_current_plan_exp", data.expiresAt);
            }
          } else {
            localStorage.setItem("morngpt_current_plan", "Pro");
          }
        } catch (err) {
          // ignore localStorage errors
        }

        setStatus("success");
        setMessage("Payment completed. Your plan is upgraded.");
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message || "Failed to capture PayPal order.");
      }
    };

    confirm();
  }, [searchParams]);

  const goHome = () => router.push("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center space-y-3">
          {status === "processing" && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
              <CardTitle className="text-lg text-gray-900">Completing PayPal payment...</CardTitle>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
              <CardTitle className="text-lg text-green-600">Payment Success</CardTitle>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <CardTitle className="text-lg text-red-600">Payment Failed</CardTitle>
            </>
          )}
          <p className="text-sm text-gray-600">{message}</p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={goHome} variant="default">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

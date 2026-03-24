"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PayPalCancelPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center space-y-3">
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
          <CardTitle className="text-lg text-gray-900">Payment Cancelled</CardTitle>
          <p className="text-sm text-gray-600">
            You cancelled the PayPal checkout. You can try again anytime.
          </p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => router.push("/")}>Back to Home</Button>
        </CardContent>
      </Card>
    </div>
  );
}

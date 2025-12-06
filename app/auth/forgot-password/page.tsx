"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">重置密码</h1>
          <p className="text-sm text-gray-600 mt-1">
            输入邮箱以接收重置链接
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSend}>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {sent && (
            <p className="text-sm text-green-600">邮件已发送，请查收。</p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-white"
          >
            发送重置邮件
          </button>
        </form>
      </div>
    </div>
  );
}

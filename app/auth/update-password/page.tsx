"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "updating" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("updating");
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("success");
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">设置新密码</h1>
        <form className="space-y-3" onSubmit={handleUpdate}>
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            placeholder="新密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {status === "success" && (
            <p className="text-sm text-green-600">密码已更新，请返回登录。</p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-white"
            disabled={status === "updating"}
          >
            {status === "updating" ? "更新中..." : "确认更新"}
          </button>
        </form>
      </div>
    </div>
  );
}

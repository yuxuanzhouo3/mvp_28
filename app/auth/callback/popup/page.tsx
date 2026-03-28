"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * OAuth 弹窗回调页面
 * 
 * 当用户通过弹窗方式进行 Google OAuth 登录时，Google 回调到此页面。
 * 此页面从 URL hash 中提取 access_token 和 refresh_token（implicit flow），
 * 通过 postMessage 发送给 opener 窗口，然后自动关闭弹窗。
 */
export default function PopupCallbackPage() {
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // 从 URL hash 中提取 tokens (implicit flow)
                const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
                const access_token = hashParams.get("access_token");
                const refresh_token = hashParams.get("refresh_token");

                // 检查 URL 参数中的错误
                const urlParams = new URLSearchParams(window.location.search);
                const errorParam = urlParams.get("error");
                const errorDescription = urlParams.get("error_description");

                if (errorParam) {
                    throw new Error(errorDescription || errorParam);
                }

                if (!access_token || !refresh_token) {
                    throw new Error("No tokens found in callback URL");
                }

                // 使用 Supabase 设置 session
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data, error: sessionError } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });

                if (sessionError) {
                    throw sessionError;
                }

                // 通过 postMessage 将登录结果发送给 opener 窗口
                if (window.opener) {
                    window.opener.postMessage({
                        type: "GOOGLE_AUTH_SUCCESS",
                        payload: {
                            access_token,
                            refresh_token,
                            user: data.session?.user ? {
                                id: data.session.user.id,
                                email: data.session.user.email,
                                name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name,
                            } : null,
                        },
                    }, window.location.origin);

                    setStatus("success");

                    // 短暂延迟后关闭弹窗
                    setTimeout(() => {
                        window.close();
                    }, 500);
                } else {
                    // 如果没有 opener（直接访问），跳转到首页
                    setStatus("success");
                    setTimeout(() => {
                        window.location.href = "/";
                    }, 500);
                }
            } catch (err) {
                console.error("[PopupCallback] Error:", err);
                setErrorMsg(err instanceof Error ? err.message : "Unknown error");
                setStatus("error");

                // 错误也通知 opener
                if (window.opener) {
                    window.opener.postMessage({
                        type: "GOOGLE_AUTH_ERROR",
                        payload: { error: err instanceof Error ? err.message : "Unknown error" },
                    }, window.location.origin);
                }
            }
        };

        handleCallback();
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            fontFamily: "system-ui, sans-serif",
            background: "#f8f9fa",
        }}>
            {status === "processing" && (
                <>
                    <div style={{
                        width: 40, height: 40,
                        border: "4px solid #e0e0e0",
                        borderTop: "4px solid #4285F4",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                    }} />
                    <p style={{ marginTop: 16, color: "#666" }}>Processing login...</p>
                </>
            )}
            {status === "success" && (
                <>
                    <div style={{ fontSize: 48 }}>✅</div>
                    <p style={{ marginTop: 16, color: "#34A853", fontWeight: "bold" }}>Login successful!</p>
                    <p style={{ color: "#666", fontSize: 14 }}>This window will close automatically...</p>
                </>
            )}
            {status === "error" && (
                <>
                    <div style={{ fontSize: 48 }}>❌</div>
                    <p style={{ marginTop: 16, color: "#EA4335", fontWeight: "bold" }}>Login failed</p>
                    <p style={{ color: "#666", fontSize: 14 }}>{errorMsg}</p>
                    <button
                        onClick={() => window.close()}
                        style={{
                            marginTop: 16, padding: "8px 24px",
                            background: "#4285F4", color: "white",
                            border: "none", borderRadius: 8, cursor: "pointer",
                        }}
                    >
                        Close
                    </button>
                </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

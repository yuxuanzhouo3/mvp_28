"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, RotateCcw, AlertTriangle, Clock, X } from "lucide-react";

interface DeletedConversation {
    id: string;
    title: string;
    model: string | null;
    created_at: string;
    deleted_at: string;
    modelType: string | null;
}

interface TrashDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isZh: boolean;
    onRestored?: () => void; // callback when a conversation is restored
}

export default function TrashDialog({ isOpen, onClose, isZh, onRestored }: TrashDialogProps) {
    const [conversations, setConversations] = useState<DeletedConversation[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadTrash = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/conversations/trash", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setConversations(data.conversations || []);
            }
        } catch (err) {
            console.error("Failed to load trash:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadTrash();
        }
    }, [isOpen, loadTrash]);

    const restoreConversation = async (id: string) => {
        setActionLoading(id);
        try {
            const res = await fetch(`/api/conversations/${id}/restore`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                setConversations((prev) => prev.filter((c) => c.id !== id));
                onRestored?.();
            }
        } catch (err) {
            console.error("Restore failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const permanentDelete = async (id: string) => {
        setActionLoading(id);
        try {
            const res = await fetch(`/api/conversations/${id}?permanent=true`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok || res.status === 204) {
                setConversations((prev) => prev.filter((c) => c.id !== id));
            }
        } catch (err) {
            console.error("Permanent delete failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const emptyTrash = async () => {
        setActionLoading("empty");
        try {
            const res = await fetch("/api/conversations/trash", {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                setConversations([]);
            }
        } catch (err) {
            console.error("Empty trash failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const getDaysRemaining = (deletedAt: string): number => {
        const deleted = new Date(deletedAt);
        const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {isZh ? "回收站" : "Recycle Bin"}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isZh ? `${conversations.length} 个对话` : `${conversations.length} conversation(s)`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {conversations.length > 0 && (
                            <button
                                onClick={emptyTrash}
                                disabled={actionLoading === "empty"}
                                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                            >
                                {actionLoading === "empty"
                                    ? (isZh ? "清空中..." : "Emptying...")
                                    : (isZh ? "清空回收站" : "Empty Trash")}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            <Trash2 className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">{isZh ? "回收站是空的" : "Trash is empty"}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {conversations.map((conv) => {
                                const daysLeft = getDaysRemaining(conv.deleted_at);
                                const isExpiringSoon = daysLeft <= 7;
                                return (
                                    <div
                                        key={conv.id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {conv.title || (isZh ? "无标题" : "Untitled")}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Clock className="w-3 h-3 text-gray-400" />
                                                <span className={`text-xs ${isExpiringSoon ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {isZh
                                                        ? `${daysLeft} 天后永久删除`
                                                        : `${daysLeft} day(s) until permanent deletion`}
                                                </span>
                                                {isExpiringSoon && (
                                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => restoreConversation(conv.id)}
                                                disabled={actionLoading === conv.id}
                                                className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                                                title={isZh ? "恢复" : "Restore"}
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => permanentDelete(conv.id)}
                                                disabled={actionLoading === conv.id}
                                                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                title={isZh ? "永久删除" : "Delete forever"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        {isZh
                            ? "对话将在删除后 30 天内自动永久清除"
                            : "Conversations are permanently deleted after 30 days"}
                    </p>
                </div>
            </div>
        </div>
    );
}

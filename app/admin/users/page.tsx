"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminUsers, toggleUserBan, type AdminUser } from "@/actions/admin-users";
import {
    Search,
    X,
    Users,
    Shield,
    ShieldOff,
    Crown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Filter,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type FilterType = "all" | "paid" | "free" | "banned";

export default function UsersManagementPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(15);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        const result = await getAdminUsers(page, pageSize, search, filter);
        if (result.success && result.data) {
            setUsers(result.data.users);
            setTotal(result.data.total);
        }
        setLoading(false);
    }, [page, pageSize, search, filter]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadUsers();
    };

    const handleBanToggle = async (userId: string, currentBan: boolean) => {
        setActionLoading(userId);
        const result = await toggleUserBan(userId, !currentBan);
        if (result.success) {
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === userId ? { ...u, is_banned: !currentBan } : u
                )
            );
        }
        setActionLoading(null);
    };

    const totalPages = Math.ceil(total / pageSize);

    const filterButtons: { label: string; value: FilterType; icon: React.ReactNode }[] = [
        { label: "全部", value: "all", icon: <Users className="w-3.5 h-3.5" /> },
        { label: "付费", value: "paid", icon: <Crown className="w-3.5 h-3.5" /> },
        { label: "免费", value: "free", icon: <User className="w-3.5 h-3.5" /> },
        { label: "封禁", value: "banned", icon: <ShieldOff className="w-3.5 h-3.5" /> },
    ];

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">用户管理</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        共 {total} 个用户
                    </p>
                </div>
            </div>

            {/* Search and Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder="搜索邮箱或用户名..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            setPage(1);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                    >
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </div>
                            <Button type="submit" size="sm">
                                搜索
                            </Button>
                        </form>

                        <div className="flex gap-1">
                            {filterButtons.map((fb) => (
                                <Button
                                    key={fb.value}
                                    variant={filter === fb.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setFilter(fb.value);
                                        setPage(1);
                                    }}
                                    className="gap-1.5 text-xs"
                                >
                                    {fb.icon}
                                    {fb.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Users className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">暂无用户数据</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">用户</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">邮箱</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">会员</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">注册时间</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">状态</th>
                                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                                        >
                                            {/* User */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                                        {user.avatar_url ? (
                                                            <img
                                                                src={user.avatar_url}
                                                                alt=""
                                                                className="w-full h-full rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            (user.display_name || user.email || "?").charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                                                        {user.display_name || "未设置"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Email */}
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                                                {user.email || "-"}
                                            </td>

                                            {/* Plan */}
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant={user.is_paid ? "default" : "secondary"}
                                                    className={
                                                        user.is_paid
                                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                            : ""
                                                    }
                                                >
                                                    {user.plan === "pro"
                                                        ? "Pro"
                                                        : user.plan === "enterprise"
                                                            ? "Enterprise"
                                                            : "Free"}
                                                </Badge>
                                            </td>

                                            {/* Created */}
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                                {formatDate(user.created_at)}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                {user.is_banned ? (
                                                    <Badge variant="destructive" className="text-xs">
                                                        已封禁
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
                                                        正常
                                                    </Badge>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant={user.is_banned ? "outline" : "destructive"}
                                                            size="sm"
                                                            disabled={actionLoading === user.id}
                                                            className="text-xs h-7"
                                                        >
                                                            {actionLoading === user.id ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : user.is_banned ? (
                                                                <>
                                                                    <Shield className="w-3 h-3 mr-1" />
                                                                    解封
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ShieldOff className="w-3 h-3 mr-1" />
                                                                    封禁
                                                                </>
                                                            )}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                {user.is_banned ? "确认解封用户？" : "确认封禁用户？"}
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {user.is_banned
                                                                    ? `解封后用户 ${user.email || user.display_name} 将恢复正常使用。`
                                                                    : `封禁后用户 ${user.email || user.display_name} 将无法登录和使用服务。`}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleBanToggle(user.id, user.is_banned)}
                                                            >
                                                                确认
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-xs text-gray-500">
                                第 {page} / {totalPages} 页
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="h-7"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="h-7"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

import { getAdminSession } from "@/utils/session";
import AdminSidebar from "./components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 中间件已处理认证重定向，这里只获取用户信息用于显示
  const session = await getAdminSession();

  // 如果没有 session（被中间件放行的登录页），直接渲染 children
  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex">
        {/* 侧边栏 */}
        <AdminSidebar username={session.username} />

        {/* 主内容区 */}
        <main className="flex-1 ml-64 p-8">{children}</main>
      </div>
    </div>
  );
}

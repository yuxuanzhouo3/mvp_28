export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 登录页使用独立布局，不显示侧边栏
  return <>{children}</>;
}

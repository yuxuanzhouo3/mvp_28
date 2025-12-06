export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow">
        <h1 className="text-xl font-semibold mb-2">注册成功</h1>
        <p className="text-sm text-gray-600">
          我们已向您的邮箱发送确认邮件，请完成验证后返回登录。
        </p>
      </div>
    </div>
  );
}

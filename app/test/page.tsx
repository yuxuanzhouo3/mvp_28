'use client';

export default function TestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <button
        className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white active:bg-blue-700 touch-manipulation"
        onClick={() => {
          // 按钮逻辑待实现
        }}
      >
        测试
      </button>
    </div>
  );
}

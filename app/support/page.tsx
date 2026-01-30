"use client";

import { Mail, HelpCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function SupportPage() {
  const { currentLanguage, setCurrentLanguage } = useLanguage();
  const isZh = currentLanguage === "zh";

  const faqs = isZh
    ? [
        {
          question: "如何重置密码？",
          answer: "点击登录页面的\"忘记密码\"链接，输入您的邮箱地址，我们会发送重置密码的链接到您的邮箱。",
        },
        {
          question: "App 无法联网怎么办？",
          answer: "请检查您的网络连接是否正常，确保已授予 MornGPT 网络访问权限。如果问题仍然存在，请尝试重启应用。",
        },
        {
          question: "如何切换 AI 模型？",
          answer: "在聊天界面顶部，点击模型选择器即可切换不同的 AI 模型。不同模型有不同的特点和能力。",
        },
        {
          question: "如何删除聊天记录？",
          answer: "在聊天列表中，长按或右键点击要删除的对话，选择\"删除\"选项即可。",
        },
      ]
    : [
        {
          question: "How do I reset my password?",
          answer: 'Click the "Forgot Password" link on the login page, enter your email address, and we will send you a password reset link.',
        },
        {
          question: "What if the app can\'t connect to the internet?",
          answer: "Please check your network connection and ensure MornGPT has network access permissions. If the issue persists, try restarting the app.",
        },
        {
          question: "How do I switch AI models?",
          answer: "At the top of the chat interface, click the model selector to switch between different AI models. Each model has unique features and capabilities.",
        },
        {
          question: "How do I delete chat history?",
          answer: "In the chat list, long-press or right-click on the conversation you want to delete and select the \"Delete\" option.",
        },
      ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{isZh ? "返回 MornGPT" : "Back to MornGPT"}</span>
          </Link>
          <button
            onClick={() => setCurrentLanguage(isZh ? "en" : "zh")}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            {isZh ? "English" : "中文"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {isZh ? "技术支持" : "Technical Support"}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {isZh ? "MornGPT 官方支持页面" : "Official MornGPT Support Page"}
          </p>
        </div>

        {/* Contact Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {isZh ? "联系我们" : "Contact Us"}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {isZh
                  ? "如果您有任何问题或需要帮助，请通过以下邮箱联系我们："
                  : "If you have any questions or need assistance, please contact us at:"}
              </p>
              <a
                href="mailto:mornscience@gmail.com"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                mornscience@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {isZh ? "常见问题" : "Frequently Asked Questions"}
            </h2>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-6 last:pb-0"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            {isZh
              ? "© 2026 MornGPT. 保留所有权利。"
              : "© 2026 MornGPT. All rights reserved."}
          </p>
        </div>
      </main>
    </div>
  );
}

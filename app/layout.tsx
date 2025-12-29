import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Script from 'next/script'
import './globals.css'
import { DEFAULT_LANGUAGE, IS_DOMESTIC_VERSION } from '../config'
import { LanguageProvider } from '../context/LanguageContext'
import { Toaster } from '@/components/ui/sonner'
import { DynamicTitle } from '@/components/DynamicTitle'

export const metadata: Metadata = {
  title: "MornGPT",
  description: "MornGPT intelligent AI assistant",
  generator: "MornGPT",
  icons: {
    icon: [
      { url: "/logo108.png", type: "image/png", sizes: "108x108" },
      { url: "/logo28.png", type: "image/png", sizes: "28x28" },
      { rel: "shortcut icon", url: "/logo108.png", type: "image/png" },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={DEFAULT_LANGUAGE}>
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        {/* 微信 JS-SDK - 仅国内版加载，用于小程序 web-view 环境 */}
        {IS_DOMESTIC_VERSION && (
          <Script
            src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"
            strategy="beforeInteractive"
          />
        )}
        <LanguageProvider>
          <DynamicTitle />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </LanguageProvider>
      </body>
    </html>
  )
}

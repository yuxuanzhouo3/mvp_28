import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { DEFAULT_LANGUAGE } from '../config'
import { LanguageProvider } from '../context/LanguageContext'
import { Toaster } from '@/components/ui/sonner'

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
        <LanguageProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </LanguageProvider>
      </body>
    </html>
  )
}

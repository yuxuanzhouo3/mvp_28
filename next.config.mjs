/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    MAX_IMAGE_UPLOAD_MB: process.env.MAX_IMAGE_UPLOAD_MB,
    MAX_VIDEO_UPLOAD_MB: process.env.MAX_VIDEO_UPLOAD_MB,
    MAX_AUDIO_UPLOAD_MB: process.env.MAX_AUDIO_UPLOAD_MB,
  },
  // 排除 Node.js 特定的包，防止它们被捆绑进 Edge Runtime
  serverExternalPackages: [
    '@cloudbase/node-sdk',
    'alipay-sdk',
    'bcryptjs',
  ],
  // 配置 Server Actions 请求体大小限制
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // 支持最大 10MB 的文件上传
    },
  },
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // 启用图片优化以提升性能
    unoptimized: false,
    // 配置远程图片域名（如有需要可添加）
    remotePatterns: [],
    // 图片格式优化
    formats: ['image/avif', 'image/webp'],
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
  // 性能优化：启用压缩
  compress: true,
  // 性能优化：生产环境移除 console.log
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // 性能优化：配置 headers 缓存策略
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // 启用 SharedArrayBuffer 以支持 FFmpeg.wasm 视频转换
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
}

export default nextConfig

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
}

export default nextConfig

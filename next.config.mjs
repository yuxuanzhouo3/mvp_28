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
  // Allow larger uploads for multimedia
  middlewareClientMaxBodySize: "100mb",
  env: {
    MAX_IMAGE_UPLOAD_MB: process.env.MAX_IMAGE_UPLOAD_MB,
    MAX_VIDEO_UPLOAD_MB: process.env.MAX_VIDEO_UPLOAD_MB,
  },
}

export default nextConfig

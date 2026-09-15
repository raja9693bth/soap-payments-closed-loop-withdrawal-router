import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (backendUrl && !backendUrl.startsWith('http://127.0.0.1') && !backendUrl.startsWith('http://localhost')) {
      const cleanBackend = backendUrl.replace(/\/$/, '');
      return [
        {
          source: '/api/:path*',
          destination: `${cleanBackend}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

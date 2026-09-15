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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

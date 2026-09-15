import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/overview',
          '/withdrawals',
          '/users',
          '/payment-instruments',
          '/ledger',
          '/webhooks',
          '/developers',
          '/audit-logs',
          '/settings',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://soap-payments-closed-loop-withdrawal-router.vercel.app/sitemap.xml',
  };
}

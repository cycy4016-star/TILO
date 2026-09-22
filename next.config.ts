import type { NextConfig } from 'next';

// Eager-load so @t3-oss validates env on every build (relative path: @/ won't resolve here).
import './src/lib/env';

import {
  appCapabilities,
  userConfigPlugins,
  userNextConfig,
  userRemotePatterns,
} from './next.user-config';
import { buildPermissionsPolicy } from './src/lib/permissions-policy';

const nextConfig: NextConfig = {
  ...userNextConfig,
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [...userRemotePatterns],
    localPatterns: [{ pathname: '/assets/**', search: '' }],
    dangerouslyAllowLocalIP: false,
    qualities: [75],
  },

  // Security headers. CSP is set in `proxy.ts` because the nonce is per-request.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: buildPermissionsPolicy(appCapabilities),
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

// Compose user config plugins outermost, then re-assert the security keys so a
// plugin can extend the build but never drop the security headers.
const withConfigPlugins = userConfigPlugins.reduce((config, plugin) => plugin(config), nextConfig);

export default {
  ...withConfigPlugins,
  headers: nextConfig.headers,
  poweredByHeader: false,
} satisfies NextConfig;

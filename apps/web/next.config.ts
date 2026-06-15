import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@lifesync/ui', '@lifesync/shared-types', 'api'],
  // Linting is handled by the root flat ESLint config, not `next lint`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use webpack (not turbopack) to support Injective SDK node polyfills
  transpilePackages: [
    '@injectivelabs/sdk-ts',
    '@injectivelabs/networks',
    '@injectivelabs/utils',
    '@injectivelabs/ts-types'
  ],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        buffer: false,
      };
    }
    return config;
  },
};

export default nextConfig;

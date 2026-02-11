import withBundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  allowedDevOrigins: ['http://localhost:3030', 'http://127.0.0.1:3030', 'http://192.168.2.190:3030'],
  serverExternalPackages: ['@distube/ytdl-core'],

  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'node_modules/onnxruntime-web/dist/*.{wasm,mjs}',
            to: ({ context }) => {
              return `${context}/public/wasm/[name][ext]`;
            },
          },
          {
            from: 'node_modules/@ffmpeg/core/dist/esm/*.{js,wasm}',
            to: ({ context }) => {
              return `${context}/public/ffmpeg/[name][ext]`;
            },
          },
          {
            from: 'node_modules/@ffmpeg/core/dist/umd/*.{js,wasm}',
            to: ({ context }) => {
              return `${context}/public/ffmpeg/umd/[name][ext]`;
            },
          },
          {
            from: 'node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js',
            to: ({ context }) => {
              return `${context}/public/ffmpeg/umd/ffmpeg.js`;
            },
          },
        ],
      })
    );

    config.output.webassemblyModuleFilename =
      isServer ? "../static/wasm/[modulehash].wasm" : "static/wasm/[modulehash].wasm";

    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
      exclude: /onnxruntime-web/,
    });

    if (!isServer) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [import.meta.url],
        },
      };
    }

    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-no-referrer-when-downgrade",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com; media-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws: wss: https://github.com https://githubusercontent.com https://huggingface.co https://unpkg.com; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:;",
          },
        ],
      },
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/wasm/:path*.wasm",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Content-Type",
            value: "application/wasm",
          },
        ],
      },
      {
        source: "/wasm/:path*.mjs",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Content-Type",
            value: "text/javascript",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
})(nextConfig));

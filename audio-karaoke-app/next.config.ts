
import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  compress: true,
  // Add allowedDevOrigins to enable cross-origin requests from specific development origins.
  allowedDevOrigins: ['http://192.168.2.190:3000'],
  outputFileTracingRoot: '../../',

  // Webpack configuration (backward compatibility)
  webpack: (config, { isServer }) => {
    // Import CopyWebpackPlugin
    const CopyWebpackPlugin = require('copy-webpack-plugin');

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Copy ONNX Runtime WASM files to public/wasm
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'node_modules/onnxruntime-web/dist/*.{wasm,mjs}',
            to: ({ context }: { context: string }) => {
              return `${context}/public/wasm/[name][ext]`;
            },
          },
        ],
      })
    );

    // Configure WASM output paths
    config.output.webassemblyModuleFilename =
      isServer ? "../static/wasm/[modulehash].wasm" : "static/wasm/[modulehash].wasm";

    // Handle .wasm files, but exclude onnxruntime-web's wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
      exclude: /onnxruntime-web/,
    });

    // Cache optimization
    if (!isServer) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }

    return config;
  },

  // Allow loading WASM from external sources and set security headers
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
          // Allow WASM execution with Content-Security-Policy
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://github.com https://githubusercontent.com https://huggingface.co https://unpkg.com; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:;",
          },
        ],
      },
      // Cache ONNX models and WASM files for 1 year
      {
        source: "/public/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/public/wasm/:path*",
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
    ];
  },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
})(nextConfig);

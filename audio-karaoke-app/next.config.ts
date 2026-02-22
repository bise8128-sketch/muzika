import type { NextConfig } from "next";
import * as path from "path";
import { fileURLToPath } from "url";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const __filename = fileURLToPath(import.meta.url);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.join(__dirname, '../../'),
  compress: true,
  // Add allowedDevOrigins to enable cross-origin requests from specific development origins.
  allowedDevOrigins: [
    "http://localhost:3030",
    "http://127.0.0.1:3030",
    "http://192.168.2.190:3030",
  ],

  // External packages that should not be bundled by Webpack
  serverExternalPackages: ["@distube/ytdl-core"],

  transpilePackages: ["tone"],

  // Webpack configuration (backward compatibility)
  webpack: (config, { isServer }) => {
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
            from: "node_modules/onnxruntime-web/dist/*.{wasm,mjs}",
            to: ({ context }: { context: string }) => {
              return `${context}/public/wasm/[name][ext]`;
            },
          },
          {
            from: "node_modules/@ffmpeg/core/dist/esm/*.{js,wasm}",
            to: ({ context }: { context: string }) => {
              return `${context}/public/ffmpeg/[name][ext]`;
            },
          },
          // Copy UMD builds for Web Worker usage
          {
            from: "node_modules/@ffmpeg/core/dist/umd/*.{js,wasm}",
            to: ({ context }: { context: string }) => {
              return `${context}/public/ffmpeg/umd/[name][ext]`;
            },
          },
          {
            from: "node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js",
            to: ({ context }: { context: string }) => {
              return `${context}/public/ffmpeg/umd/ffmpeg.js`;
            },
          },
        ],
      }),
    );

    // Configure WASM output paths
    config.output.webassemblyModuleFilename = isServer
      ? "../static/wasm/[modulehash].wasm"
      : "static/wasm/[modulehash].wasm";

    // Handle .wasm files, but exclude onnxruntime-web's wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
      exclude: /onnxruntime-web/,
    });

    // Cache optimization
    if (!isServer) {
      config.cache = {
        type: "filesystem",
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
            value:
              "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com https://cdn.logr-in.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com; media-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws: wss: https://github.com https://githubusercontent.com https://huggingface.co https://unpkg.com https://*.logrocket.io https://*.logrocket.com https://*.ld-7.com; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:;",
          },
        ],
      },
      // Cache ONNX models and WASM files for 1 year
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

export default withSerwist(
  withNextIntl(
    withBundleAnalyzer({
      enabled: process.env.ANALYZE === "true",
      openAnalyzer: false,
    })(nextConfig),
  ),
);

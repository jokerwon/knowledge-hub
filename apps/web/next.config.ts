import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Action 默认 body 上限 1MB，会拦下 2 MiB 的合法上传。
    // 调到 3mb 给 multipart 开销留余量；真实上限仍由 api 的 UPLOAD_MAX_BYTES 决定。
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;

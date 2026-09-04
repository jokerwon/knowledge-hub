"use client";

import * as React from "react";
import type { DocumentDto } from "@kh/shared";
import { useRouter } from "next/navigation";

// 列表存在 processing 文档时自动轮询（ADR 0001 决策 3）：状态变化无需手动刷新。
// 经 router.refresh() 走 RSC 重取——api 不对浏览器开放，数据通路保持服务端。
const POLL_INTERVAL_MS = 3000;

export function PollWhenProcessing({
  documents,
}: {
  documents: DocumentDto[];
}) {
  const router = useRouter();
  const hasProcessing = documents.some((doc) => doc.status === "processing");

  React.useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasProcessing, router]);

  return null;
}

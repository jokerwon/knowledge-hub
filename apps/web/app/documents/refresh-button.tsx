"use client";

import { RotateCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// RSC 页面无法自己重试；用 router.refresh() 重新请求服务端组件。
export function RefreshButton() {
  const router = useRouter();
  return (
    <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
      <RotateCwIcon data-icon="inline-start" />
      重试
    </Button>
  );
}

"use client";

import * as React from "react";
import { DEFAULT_MAX_UPLOAD_BYTES } from "@kh/shared";
import { UploadIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileUpload,
  type FileUploadItem,
} from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { uploadDocument } from "./actions";

const MAX_LABEL = `${Math.round(DEFAULT_MAX_UPLOAD_BYTES / 1024 / 1024)} MB`;
const ALLOWED_PATTERN = /\.(md|txt)$/i;

// 前端先拦无谓请求（扩展名 / 大小）；api 侧仍是最终裁决。
function validate(file: File): string | null {
  if (!ALLOWED_PATTERN.test(file.name)) return "仅支持 .md / .txt 文件";
  if (file.size > DEFAULT_MAX_UPLOAD_BYTES) return `超过 ${MAX_LABEL} 大小上限`;
  return null;
}

// 上传入口：模态框内 FileUpload 队列 + Server Action。
// 队列 UI/拖拽/重试由 FileUpload 承担；状态机（uploading/success/error）由本组件驱动。
export function UploadDialog() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<FileUploadItem[]>([]);

  function patchItem(id: string, patch: Partial<FileUploadItem>) {
    setItems((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  // Server Action 是原子调用（无进度事件）：进行中停在 0%，成功一次性到 100%。
  async function upload(item: FileUploadItem) {
    if (!item.file) return;
    patchItem(item.id, { status: "uploading", progress: 0, error: undefined });
    const result = await uploadDocument(item.file);
    patchItem(
      item.id,
      result.ok
        ? { status: "success", progress: 100, error: undefined }
        : { status: "error", error: result.error },
    );
  }

  function handleFilesAdded(added: FileUploadItem[]) {
    for (const item of added) {
      if (!item.file) continue;
      const invalid = validate(item.file);
      if (invalid) {
        // 违规文件不产生请求，错误就地显示在队列行上
        patchItem(item.id, { status: "error", error: invalid });
        continue;
      }
      void upload(item);
    }
  }

  function handleRetry(item: FileUploadItem) {
    if (!item.file) return;
    const invalid = validate(item.file);
    if (invalid) {
      // 客户端可判定的违规，重试也过不了本地校验，不发请求
      patchItem(item.id, { status: "error", error: invalid });
      return;
    }
    void upload(item);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 关闭即清空队列，下次打开是干净状态（已上传的文档在列表里）
        if (!next) setItems([]);
      }}
    >
      <DialogTrigger render={<Button />}>
        <UploadIcon data-icon="inline-start" />
        上传文档
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传文档</DialogTitle>
          <DialogDescription>
            拖拽或选择 .md / .txt 文件，单文件 ≤ {MAX_LABEL}，单次一个。
          </DialogDescription>
        </DialogHeader>
        <FileUpload
          value={items}
          onValueChange={setItems}
          onFilesAdded={handleFilesAdded}
          onRetry={handleRetry}
          accept=".md,.txt"
          multiple={false}
          variant="centered"
          title="拖拽文件到此处"
          description={`仅支持 .md / .txt，单文件 ≤ ${MAX_LABEL}`}
          browseLabel="选择文件"
        />
      </DialogContent>
    </Dialog>
  );
}

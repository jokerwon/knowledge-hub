import type { DocumentDto } from "@kh/shared";
import { FileTextIcon, Loader2Icon } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { fetchDocuments } from "@/lib/api-server";
import { DeleteDocumentButton } from "./delete-document-button";
import { PollWhenProcessing } from "./poll-when-processing";
import { RefreshButton } from "./refresh-button";
import { UploadDialog } from "./upload-dialog";

export const metadata = {
  title: "文档 — Knowledge Hub",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function DocumentsPage() {
  // api 不可达时给错误面板，不让页面崩掉
  const documents = await fetchDocuments().catch(() => null);

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-headline">文档</h1>
          {documents !== null && (
            <p className="text-caption text-ink-subtle">
              共 {documents.length} 篇
            </p>
          )}
        </div>
        <div className="ml-auto">
          <UploadDialog />
        </div>
      </div>
      {documents === null ? (
        <ListErrorPanel />
      ) : documents.length === 0 ? (
        <DocumentsEmpty />
      ) : (
        <>
          <PollWhenProcessing documents={documents} />
          <DocumentList documents={documents} />
        </>
      )}
    </>
  );
}

function DocumentList({ documents }: { documents: DocumentDto[] }) {
  return (
    <ul className="panel-highlight overflow-hidden rounded-lg border border-hairline bg-surface-1">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="border-b border-hairline px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <FileTextIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-subtle"
            />
            <div className="min-w-0 flex-1">
              <span
                className="text-body-sm block truncate text-ink"
                title={doc.title}
              >
                {doc.title}
              </span>
              {doc.status === "failed" && doc.failure_reason && (
                <span
                  className="text-caption block truncate text-destructive"
                  title={doc.failure_reason}
                >
                  {doc.failure_reason}
                </span>
              )}
            </div>
            <StatusBadge status={doc.status} />
            <time
              dateTime={doc.created_at}
              className="text-caption shrink-0 text-ink-subtle"
            >
              {dateFormatter.format(new Date(doc.created_at))}
            </time>
            <DeleteDocumentButton id={doc.id} title={doc.title} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// status-badge 规格（DESIGN.md）：surface-2 底 + ink-muted 字 + pill；
// 失败态是唯一语义色（destructive），处理中带转圈提示进行中。
function StatusBadge({ status }: { status: DocumentDto["status"] }) {
  if (status === "processing") {
    return (
      <span className="text-caption flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-ink-muted">
        <Loader2Icon aria-hidden="true" className="size-3 animate-spin" />
        处理中
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-caption shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
        失败
      </span>
    );
  }
  return (
    <span className="text-caption shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-ink-muted">
      就绪
    </span>
  );
}

function DocumentsEmpty() {
  return (
    <Empty className="panel-highlight rounded-lg border border-hairline border-solid bg-surface-1 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>还没有文档</EmptyTitle>
        <EmptyDescription>
          上传第一个 .md / .txt 文件，开始构建你的知识库。
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <UploadDialog />
      </EmptyContent>
    </Empty>
  );
}

function ListErrorPanel() {
  return (
    <div className="panel-highlight flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface-1 px-6 py-12 text-center">
      <p className="text-body-sm text-ink">无法加载文档列表</p>
      <p className="text-caption text-ink-subtle">
        文档服务（api）无响应，请确认它在运行后重试。
      </p>
      <RefreshButton />
    </div>
  );
}

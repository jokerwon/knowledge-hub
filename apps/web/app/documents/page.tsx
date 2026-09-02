import type { DocumentDto } from "@kh/shared";
import { FileTextIcon } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/site/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { fetchDocuments } from "@/lib/api-server";
import { DeleteDocumentButton } from "./delete-document-button";
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Knowledge Hub</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>文档</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2 px-4">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">
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
            <DocumentList documents={documents} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DocumentList({ documents }: { documents: DocumentDto[] }) {
  return (
    <ul className="panel-highlight overflow-hidden rounded-lg border border-hairline bg-surface-1">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
        >
          <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
          <span className="text-body-sm min-w-0 flex-1 truncate text-ink" title={doc.title}>
            {doc.title}
          </span>
          <time
            dateTime={doc.created_at}
            className="text-caption shrink-0 text-ink-subtle"
          >
            {dateFormatter.format(new Date(doc.created_at))}
          </time>
          <DeleteDocumentButton id={doc.id} title={doc.title} />
        </li>
      ))}
    </ul>
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

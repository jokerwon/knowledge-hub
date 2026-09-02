import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  DatabaseIcon,
  FileTextIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";

import { fetchDocuments } from "@/lib/api-server";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "仪表盘 — Knowledge Hub",
};

/*
 * 目前唯一可用的真实指标是文档总数（GET /documents）。
 * 其余卡片 / 趋势 / 动态均为占位演示，统一带「模拟数据」标记，
 * 待对应统计能力上线后逐个替换（见各「替换点」注释）。
 */

// —— 模拟数据（替换点：上传趋势统计 API）——
const TREND_DAYS = 14;
const TREND_COUNTS = [1, 0, 2, 4, 3, 0, 2, 5, 3, 1, 4, 2, 6, 3];
const DAY_MS = 86_400_000;

const trendDays = Array.from({ length: TREND_DAYS }, (_, i) => {
  const date = new Date(Date.now() - (TREND_DAYS - 1 - i) * DAY_MS);
  return {
    label: `${date.getMonth() + 1}/${date.getDate()}`,
    count: TREND_COUNTS[i] ?? 0,
  };
});
const trendMax = Math.max(...TREND_COUNTS);

// —— 模拟数据（替换点：活动流 API）——
const ACTIVITY_ITEMS: Array<{
  icon: ComponentType<{ className?: string }>;
  text: string;
  time: string;
}> = [
  { icon: UploadIcon, text: "王倩 上传了《API 设计评审纪要》", time: "2 小时前" },
  { icon: SearchIcon, text: "李明 搜索了「部署手册」", time: "4 小时前" },
  { icon: FileTextIcon, text: "系统为 3 篇文档重建了索引", time: "昨天" },
  { icon: TrashIcon, text: "陈晓 删除了《旧版上线检查单》", time: "昨天" },
  { icon: UploadIcon, text: "王倩 上传了《Q3 产品规划》", time: "2 天前" },
];

export default async function DashboardPage() {
  // api 不可达时文档数降级为「—」，页面其余部分照常渲染
  const documents = await fetchDocuments().catch(() => null);

  return (
    <>
      <div className="flex items-baseline gap-3">
        <h1 className="text-headline">仪表盘</h1>
        <p className="text-caption text-ink-subtle">知识库概览与动态</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FileTextIcon}
          label="文档总数"
          value={documents === null ? "—" : String(documents.length)}
          footer={
            documents === null ? (
              <span>文档服务无响应，请稍后重试</span>
            ) : (
              <Link
                href="/documents"
                className="text-primary hover:text-primary-hover"
              >
                查看全部文档 →
              </Link>
            )
          }
        />
        <StatCard
          icon={UsersIcon}
          label="活跃成员"
          value="12"
          mock
          footer={<span>过去 7 天 · 团队协作上线后接入</span>}
        />
        <StatCard
          icon={SearchIcon}
          label="搜索次数"
          value="348"
          mock
          footer={<span>本周累计 · 搜索功能开发中</span>}
        />
        <StatCard
          icon={DatabaseIcon}
          label="存储用量"
          value="86.2 MB"
          mock
          footer={<span>文档正文与附件合计</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          title="上传趋势"
          aside="最近 14 天"
          mock
          className="lg:col-span-2"
        >
          <div
            className="flex h-40 items-end gap-1"
            role="img"
            aria-label="最近 14 天每日上传文档数柱状图（模拟数据）"
          >
            {trendDays.map((day) => (
              <div
                key={day.label}
                title={`${day.label} · ${day.count} 篇`}
                className={cn(
                  "flex-1 rounded-t-xs transition-colors",
                  day.count === 0
                    ? "bg-hairline-strong"
                    : "bg-ink-subtle hover:bg-ink-muted",
                )}
                style={{
                  height: `${Math.max((day.count / trendMax) * 100, 4)}%`,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-caption text-ink-tertiary">
            <span>{trendDays[0]?.label}</span>
            <span>{trendDays[trendDays.length - 1]?.label}</span>
          </div>
        </Panel>

        <Panel title="最近动态" mock>
          <ul>
            {ACTIVITY_ITEMS.map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-3 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <item.icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-subtle"
                />
                <span className="text-body-sm min-w-0 flex-1 truncate text-ink-muted">
                  {item.text}
                </span>
                <time className="text-caption shrink-0 text-ink-subtle">
                  {item.time}
                </time>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

// status-badge 规格（DESIGN.md）：surface-2 底 + ink-muted 字 + pill
function MockBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-muted",
        className,
      )}
    >
      模拟数据
    </span>
  );
}

// feature-card 规格（DESIGN.md）：surface-1 底 + hairline 边 + rounded-lg + 24px 内边距
function StatCard({
  icon: Icon,
  label,
  value,
  footer,
  mock = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  footer?: ReactNode;
  mock?: boolean;
}) {
  return (
    <div className="panel-highlight flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-6">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
        <span className="text-caption text-ink-subtle">{label}</span>
        {mock ? <MockBadge className="ml-auto" /> : null}
      </div>
      <p className="text-display-md text-ink">{value}</p>
      {footer ? (
        <div className="text-caption text-ink-subtle">{footer}</div>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  aside,
  mock = false,
  className,
  children,
}: {
  title: string;
  aside?: string;
  mock?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "panel-highlight flex flex-col gap-6 rounded-lg border border-hairline bg-surface-1 p-6",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <h2 className="text-card-title text-ink">{title}</h2>
        {mock ? <MockBadge /> : null}
        {aside ? (
          <span className="ml-auto text-caption text-ink-subtle">{aside}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

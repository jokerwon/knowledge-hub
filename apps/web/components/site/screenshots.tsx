import {
  BookOpen,
  ChevronDown,
  Inbox,
  Layers,
  ListTodo,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

import { LogoMark } from "@/components/site/logo";

/*
 * High-fidelity product UI mockups — the protagonist of the page per
 * DESIGN.md. Product surfaces may use the in-product tag palette
 * (status yellows/greens, label hues) that never appears on marketing chrome.
 */

type Status = "progress" | "todo" | "backlog";

function StatusIcon({ status }: { status: Status }) {
  if (status === "progress") {
    return (
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="5.75" fill="none" stroke="#ebbb4d" strokeWidth="1.5" />
        <path d="M7 1.25a5.75 5.75 0 0 0 0 11.5Z" fill="#ebbb4d" />
      </svg>
    );
  }
  if (status === "todo") {
    return (
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="5.75" fill="none" stroke="#8a8f98" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="5.75"
        fill="none"
        stroke="#62666d"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

type Priority = "urgent" | "high" | "medium" | "low";

function PriorityIcon({ level }: { level: Priority }) {
  const filled = { urgent: 3, high: 3, medium: 2, low: 1 }[level];
  const color = level === "urgent" ? "#eb5757" : "#8a8f98";
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={1 + index * 4.5}
          y={13 - (5 + index * 4)}
          width="3"
          height={5 + index * 4}
          rx="0.5"
          fill={index < filled ? color : "#23252a"}
        />
      ))}
    </svg>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function LabelPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface-1 px-1.5 py-0.5 text-[10px] text-ink-subtle sm:inline-flex">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

type Issue = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  label?: { name: string; color: string };
  assignee: { initials: string; color: string };
};

const inProgress: Issue[] = [
  {
    id: "KH-214",
    title: "Streaming sync for GitHub issue links",
    status: "progress",
    priority: "urgent",
    label: { name: "Platform", color: "#5e6ad2" },
    assignee: { initials: "RA", color: "#5e6ad2" },
  },
  {
    id: "KH-201",
    title: "Backfill command for imported Confluence spaces",
    status: "progress",
    priority: "high",
    label: { name: "Infra", color: "#57a9ff" },
    assignee: { initials: "MW", color: "#57a9ff" },
  },
  {
    id: "KH-198",
    title: "Keyboard-first navigation in the doc tree",
    status: "progress",
    priority: "medium",
    assignee: { initials: "PN", color: "#7a7fad" },
  },
];

const todo: Issue[] = [
  {
    id: "KH-221",
    title: "Page ownership review digests",
    status: "todo",
    priority: "medium",
    label: { name: "Growth", color: "#ebbb4d" },
    assignee: { initials: "SC", color: "#27a644" },
  },
  {
    id: "KH-219",
    title: "Saved views in full-text search",
    status: "todo",
    priority: "high",
    label: { name: "Platform", color: "#5e6ad2" },
    assignee: { initials: "JD", color: "#5e6ad2" },
  },
  {
    id: "KH-205",
    title: "REST API v3 pagination cursors",
    status: "backlog",
    priority: "low",
    label: { name: "Infra", color: "#57a9ff" },
    assignee: { initials: "MW", color: "#57a9ff" },
  },
];

const sidebarNav = [
  { icon: Inbox, label: "Inbox" },
  { icon: ListTodo, label: "My issues" },
  { icon: Layers, label: "All issues", active: true },
  { icon: BookOpen, label: "Wiki" },
];

const teams = [
  { label: "Platform", color: "#5e6ad2" },
  { label: "Infra", color: "#57a9ff" },
  { label: "Docs", color: "#27a644" },
];

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <li className="flex h-9 items-center gap-2.5 border-b border-hairline px-3 transition-colors hover:bg-surface-1/60">
      <StatusIcon status={issue.status} />
      <span className="font-mono text-xs text-ink-tertiary">{issue.id}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
        {issue.title}
      </span>
      {issue.label && <LabelPill {...issue.label} />}
      <PriorityIcon level={issue.priority} />
      <Avatar {...issue.assignee} />
    </li>
  );
}

/** product-screenshot-card framing the issue-list view. */
export function AppScreenshot() {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-6 panel-highlight">
      <div className="overflow-hidden rounded-lg border border-hairline bg-canvas text-left">
        <div className="flex">
          <aside className="hidden w-52 shrink-0 flex-col border-r border-hairline sm:flex">
            <div className="flex h-11 items-center gap-2 border-b border-hairline px-3">
              <LogoMark className="size-4" />
              <span className="text-[13px] font-medium text-ink">Knowledge Hub</span>
              <ChevronDown className="size-3.5 text-ink-tertiary" />
            </div>
            <nav className="flex flex-col gap-0.5 p-2">
              {sidebarNav.map((item) => (
                <span
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1 text-[13px] ${
                    item.active
                      ? "bg-surface-2 text-ink"
                      : "text-ink-subtle"
                  }`}
                >
                  <item.icon className="size-3.5 text-ink-tertiary" />
                  {item.label}
                </span>
              ))}
            </nav>
            <div className="border-t border-hairline pt-2">
              <span className="block px-4 pb-1 text-[11px] font-medium text-ink-tertiary">
                Teams
              </span>
              <nav className="flex flex-col gap-0.5 p-2">
                {teams.map((team) => (
                  <span
                    key={team.label}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-ink-subtle"
                  >
                    <span
                      className="size-2 rounded-[3px]"
                      style={{ backgroundColor: team.color }}
                    />
                    {team.label}
                  </span>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex h-11 items-center justify-between gap-2 border-b border-hairline px-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink">All issues</span>
                <span className="text-xs text-ink-tertiary">243</span>
              </div>
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="size-3.5 text-ink-tertiary" />
                <MoreHorizontal className="size-3.5 text-ink-tertiary" />
                <span className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-on-primary">
                  <Plus className="size-3" />
                  New issue
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-hairline px-2 py-1.5">
              {["All", "Active", "Backlog"].map((tab, index) => (
                <span
                  key={tab}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    index === 0
                      ? "bg-surface-2 text-ink"
                      : "text-ink-subtle hover:text-ink"
                  }`}
                >
                  {tab}
                </span>
              ))}
              <span className="ml-auto pr-1 text-xs text-ink-tertiary">Display</span>
            </div>

            <div className="flex items-center gap-2 border-b border-hairline bg-surface-1/40 px-3 py-1.5">
              <span className="text-xs font-medium text-ink-subtle">In progress</span>
              <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-ink-tertiary">
                3
              </span>
            </div>
            <ul>
              {inProgress.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </ul>

            <div className="flex items-center gap-2 border-b border-hairline bg-surface-1/40 px-3 py-1.5">
              <span className="text-xs font-medium text-ink-subtle">Todo</span>
              <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-ink-tertiary">
                3
              </span>
            </div>
            <ul>
              {todo.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
/** product-screenshot-card framing the wiki doc view. */
export function DocScreenshot() {
  return (
    <div className="min-w-0 rounded-xl border border-hairline bg-surface-1 p-6 panel-highlight">
      <div className="overflow-hidden rounded-lg border border-hairline bg-canvas text-left">
        <div className="flex h-10 items-center gap-1.5 border-b border-hairline px-3 text-xs text-ink-subtle">
          <span>Wiki</span>
          <span className="text-ink-tertiary">/</span>
          <span>Platform</span>
          <span className="text-ink-tertiary">/</span>
          <span className="text-ink">RFC-214</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted">
            <span className="size-1.5 rounded-full bg-success" />
            Accepted
          </span>
        </div>

        <div className="px-5 py-4 sm:px-7 sm:py-5">
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            RFC: Streaming ingestion v2
          </h3>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-tertiary">
            <Avatar initials="MW" color="#57a9ff" />
            <span>Marcus Webb · updated Sep 1, 2026</span>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
            Polling the GitHub API every five minutes no longer keeps up with
            link volume. This RFC proposes switching ingestion to a durable
            stream that resolves issue backlinks in under a second.
          </p>

          <h4 className="mt-4 text-[13px] font-medium text-ink">Motivation</h4>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            Median link resolution is 4m 12s; p99 exceeds fifteen minutes
            during incident retros, exactly when teams need the context most.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-md border border-hairline bg-surface-1 px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-muted">
            <code>{`$ kh stream sync --source github --follow
✓ linked 1,284 issues in 4.2s`}</code>
          </pre>

          <div className="mt-4 rounded-md border border-hairline bg-surface-1 p-3">
            <span className="text-[11px] font-medium text-ink-tertiary">
              Linked issues
            </span>
            <ul className="mt-2">
              {[
                { id: "KH-214", title: "Streaming sync for GitHub issue links", status: "progress" as Status },
                { id: "KH-221", title: "Page ownership review digests", status: "todo" as Status },
              ].map((issue) => (
                <li key={issue.id} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                  <StatusIcon status={issue.status} />
                  <span className="font-mono text-xs text-ink-tertiary">{issue.id}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-muted">{issue.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

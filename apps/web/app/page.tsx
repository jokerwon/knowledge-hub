import { ArrowRight, Check, GitBranch, History, Layers, Lock, Search, Zap } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { AppScreenshot, DocScreenshot } from "@/components/site/screenshots";
import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";
import { cn } from "@/lib/utils";

const customers = ["Northwind", "Hexlab", "Lumina", "Cobalt", "Fathom", "Apcera"];

const features = [
  {
    icon: Layers,
    title: "Structured by default",
    body: "Docs live in a typed tree with required frontmatter. Nothing gets orphaned in a folder nobody opens.",
  },
  {
    icon: Search,
    title: "Search that keeps up",
    body: "Millisecond full-text and code search across every page, comment, and linked issue — ranked by your team's usage.",
  },
  {
    icon: GitBranch,
    title: "Wired into your workflow",
    body: "Two-way links with your issue tracker, repos, and chat. The doc updates when the issue moves; the issue carries the decision.",
  },
  {
    icon: History,
    title: "Decisions with a paper trail",
    body: "Every RFC captures the context, the options, and the call — the next engineer inherits the reasoning, not just the artifact.",
  },
  {
    icon: Lock,
    title: "Permissions that make sense",
    body: "Private spaces, guest links, and audit logs that answer who read what — without slowing anyone down.",
  },
  {
    icon: Zap,
    title: "Fast at 100k pages",
    body: "Local-first rendering and edge caching. Navigation feels instant on a ten-year-old laptop.",
  },
];

const workflowPoints = [
  "Bi-directional issue and pull request links",
  "Semantic and full-text search in one query",
  "Ownership, review reminders, and staleness alerts",
];

const testimonials = [
  {
    quote:
      "Knowledge Hub replaced three wikis and a drive folder of design docs. Our onboarding time halved.",
    name: "Sarah Chen",
    role: "Head of Engineering, Lumina",
    initials: "SC",
    color: "#5e6ad2",
  },
  {
    quote:
      "It's the first knowledge tool our engineers keep updated themselves — the issue links mean the docs write themselves.",
    name: "Marcus Webb",
    role: "Staff Engineer, Hexlab",
    initials: "MW",
    color: "#57a9ff",
  },
  {
    quote:
      "Search is instant, and tribal knowledge stopped walking out the door with every departure.",
    name: "Priya Nair",
    role: "CTO, Fathom",
    initials: "PN",
    color: "#7a7fad",
  },
];

const changelog = [
  {
    version: "v2.41",
    date: "Sep 1, 2026",
    body: "Streaming sync for GitHub issues. Backlinks now resolve in under a second.",
  },
  {
    version: "v2.40",
    date: "Aug 25, 2026",
    body: "Saved views in search and weekly ownership digests.",
  },
  {
    version: "v2.39",
    date: "Aug 18, 2026",
    body: "Keyboard-first navigation in the doc tree, plus page templates for RFCs.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-[1280px] px-4 pb-24 pt-16 sm:px-6 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-eyebrow text-ink-subtle">Knowledge, systematized</p>
            <h1 className="mt-4 text-display-xl text-ink">
              Your team&rsquo;s knowledge, in order.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-body-lg text-ink-muted">
              Knowledge Hub turns docs, decisions, and discussion into one
              structured system — searchable in milliseconds, linked to every
              issue and pull request.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#cta" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
                Get started
              </a>
              <a
                href="#workflow"
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}
              >
                Read the docs
              </a>
            </div>
          </div>
          <div className="mt-16">
            <AppScreenshot />
          </div>
        </section>

        {/* Customer marquee */}
        <section className="border-y border-hairline">
          <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
            <p className="text-center text-caption text-ink-tertiary">
              Trusted by engineering teams at
            </p>
            <div className="mt-6 grid grid-cols-3 items-center justify-items-center gap-4 md:grid-cols-6">
              {customers.map((customer) => (
                <span
                  key={customer}
                  className="rounded-xs px-4 py-4 text-caption font-semibold text-ink-subtle"
                >
                  {customer}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="product" className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-eyebrow text-ink-subtle">Product</p>
            <h2 className="mt-3 text-display-lg text-ink">A system, not another wiki</h2>
            <p className="mt-4 text-body-lg text-ink-muted">
              Every page has an owner, a status, and a place in the tree. Search
              understands code, and every decision links back to the issue it
              came from.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-hairline bg-surface-1 p-6 transition-colors hover:bg-surface-2"
              >
                <feature.icon className="size-5 text-ink-subtle" strokeWidth={1.5} />
                <h3 className="mt-4 text-card-title text-ink">{feature.title}</h3>
                <p className="mt-2 text-body-sm text-ink-subtle">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="border-t border-hairline">
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-eyebrow text-ink-subtle">Workflow</p>
              <h2 className="mt-3 text-display-lg text-ink">Written once, found forever</h2>
              <p className="mt-4 text-body-lg text-ink-muted">
                Knowledge Hub sits inside the tools your team already lives in.
                Docs surface where the work happens — not in a tab nobody
                remembers to open.
              </p>
              <ul className="mt-8 space-y-3">
                {workflowPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-1">
                      <Check className="size-3 text-ink-subtle" />
                    </span>
                    <span className="text-body text-ink-muted">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DocScreenshot />
          </div>
        </section>

        {/* Testimonials */}
        <section id="customers" className="border-t border-hairline">
          <div className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-eyebrow text-ink-subtle">Customers</p>
              <h2 className="mt-3 text-display-lg text-ink">
                Loved by the teams that build
              </h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure
                  key={testimonial.name}
                  className="flex flex-col rounded-lg border border-hairline bg-surface-1 p-8"
                >
                  <blockquote className="text-body-lg text-ink">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: testimonial.color }}
                      aria-hidden="true"
                    >
                      {testimonial.initials}
                    </span>
                    <span>
                      <span className="block text-body-sm font-medium text-ink">
                        {testimonial.name}
                      </span>
                      <span className="block text-caption text-ink-tertiary">
                        {testimonial.role}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Changelog */}
        <section id="changelog" className="border-t border-hairline">
          <div className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-eyebrow text-ink-subtle">Changelog</p>
                <h2 className="mt-3 text-display-md text-ink">Latest changes</h2>
              </div>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-body-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                View all updates
                <ArrowRight className="size-3.5" />
              </a>
            </div>
            <ul className="mt-8">
              {changelog.map((entry) => (
                <li
                  key={entry.version}
                  className="flex flex-col gap-1 border-b border-hairline py-6 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <span className="font-mono text-sm text-ink sm:w-14 sm:shrink-0">
                    {entry.version}
                  </span>
                  <span className="text-body text-ink-muted">{entry.body}</span>
                  <span className="text-caption text-ink-tertiary sm:ml-auto sm:shrink-0">
                    {entry.date}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA banner */}
        <section id="cta" className="mx-auto max-w-[1280px] px-4 py-24 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-hairline bg-surface-1 px-6 py-12 text-center panel-highlight sm:p-12">
            <h2 className="text-headline text-ink">
              Make your team&rsquo;s knowledge a product.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-muted">
              Set up in an afternoon. Import from Confluence, Notion, or Google
              Docs in one command.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
                Get started
              </a>
              <a
                href="#"
                className={cn(buttonVariants({ variant: "inverse", size: "lg" }), "w-full sm:w-auto")}
              >
                Talk to sales
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

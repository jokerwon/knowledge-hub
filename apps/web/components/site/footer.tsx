import { Logo } from "@/components/site/logo";

const columns = [
  {
    title: "Product",
    links: ["Overview", "Search", "Wiki", "Integrations", "Changelog"],
  },
  {
    title: "Resources",
    links: ["Documentation", "API reference", "Guides", "Status", "Community"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Customers", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "DPA"],
  },
];

/** footer — dense caption-size link grid on the canvas. */
export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-56 text-caption text-ink-subtle">
              The knowledge base for teams that ship.
            </p>
            {/* status-badge — the semantic success color in its one marketing role */}
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-muted">
              <span className="size-1.5 rounded-full bg-success" />
              All systems operational
            </span>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-caption font-medium text-ink">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-caption text-ink-subtle transition-colors hover:text-ink"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center">
          <p className="text-caption text-ink-tertiary">
            © 2026 Knowledge Hub, Inc.
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-caption text-ink-subtle transition-colors hover:text-ink">
              Privacy
            </a>
            <a href="#" className="text-caption text-ink-subtle transition-colors hover:text-ink">
              Terms
            </a>
            <a href="#" className="text-caption text-ink-subtle transition-colors hover:text-ink">
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

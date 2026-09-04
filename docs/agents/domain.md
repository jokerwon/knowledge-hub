# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**This repo is single-context**: one `CONTEXT.md` and one `docs/adr/` at the repo root, covering all of `apps/web`, `apps/api`, and `packages/shared`. No per-package `CONTEXT.md` or `docs/adr/`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/glossary.md`**: this repo's current ubiquitous-language glossary
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md                  ← lazily created by /domain-modeling
├── docs/
│   ├── glossary.md
│   └── adr/
│       └── 0001-pdf-upload-via-mineru.md
├── apps/
│   ├── web/
│   └── api/
└── packages/
    └── shared/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the glossary — today `docs/glossary.md`, and `CONTEXT.md` once it exists. Don't drift to synonyms the glossary explicitly avoids. The glossary is written in Chinese; keep the defined terms as-is.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (PDF upload via MinerU), but worth reopening because…_

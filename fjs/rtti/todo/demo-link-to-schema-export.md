## Link a demo schema to its export, not just its module

**Priority:** P4
**Status:** blocked
**Blocked by:**
[source and documentation view on a module page](../../website/todo/source-and-doc-view.md)

### Problem

The demo shows each schema the project uses as the import that brings it in,
`import { noteSchema } from 'fjs/media/note/module.f.mjs'`, and the quoted
module path links to the module's page on the site. That page lists the
module's files; the reader still has to find the schema in it.

When the module page shows the module's source and documentation, which is
what the issue this waits on adds, the link can land on the schema itself:
the reader picks "Note" in the demo, follows the link, and reads
`noteSchema`'s declaration and its JSDoc without scrolling through the rest
of the module.

### Proposal

- The documentation view gives each `export const` entry an anchor named for
  the export. The spelling is that issue's to decide — a bare `#noteSchema`
  could collide with an id the page already uses, so a prefixed one such as
  `#export-noteSchema` is the likelier choice.
- The demo's `codeView` in [`../demo.f.mjs`](../demo.f.mjs) appends that
  anchor to the `pageHref` it already builds, from the export name the
  example already carries as its `source`. Nothing else in the demo changes.
- The anchor is built in one place and imported by the demo, so the page and
  the link cannot spell it differently — the same reason the link uses the
  site's own `pageHref`.
- `proof.demo.view.projectSource` pins the href with its anchor.

### Related

- [`../demo.f.mjs`](../demo.f.mjs) — `codeView`, the link this changes.
- [Source and documentation view on a module page](../../website/todo/source-and-doc-view.md)
  — the view the anchor points into, and where its spelling is decided.

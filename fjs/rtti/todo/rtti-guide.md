## RTTI guide

**Priority:** P2
**Status:** wip — the schemas area, with its demos, is done

### Problem

[The RTTI README](../README.md) explained everything in one page organized
by module, and the [demo](../demo.f.mjs) taught its lessons from one
drop-down that no section of the README linked to. A reader asking "how do I
make a key optional" had to know it lives in a table row, a lesson and a
readers table. The language specification had the same shape and was split
into a tree of small pages, each with its own demo
([spec tree](../../../spec/todo/spec-tree.md)).

### Design

**A guide of concept pages**, under [`guide/`](../guide/README.md), beside the
modules rather than among them, so a concept directory is never mistaken for
a module. A page is a directory, `guide/<area>/<page>/README.md`, holding a
status line, the rule with its example, *Examples*, a *Reference* (the
TypeScript Handbook and JSON Schema 2020-12), and the module that implements
it. The module READMEs keep the *how*: implementation notes for contributors.

**A page owns its demo**, as a spec page does. The RTTI demo becomes a
factory, `schemaDemo`, that each page calls with its own lesson, so the reader
lands on that page's schema with its text above it. Each area's
`module.f.mjs` exports one lesson list per page, and the root demo assembles
its picker from those lists, one `<optgroup>` per area.

### The tree

- `schemas/`: constants, primitives, structs and tuples, open containers,
  absence, unions, arrays and records, recursion and sharing
- `readers/`: `parse` and `validate`, the error shape, what the readers
  assume of a value
- `outputs/`: the TypeScript type, JSON Schema, the canonical data form
- `in-the-project/`: one page per group of the project's own schemas

### Migration

Each step is its own pull request and leaves the site working.

- **Done:** the RTTI READMEs render on the site, and the `schemas/` area moved
  out of the root README.
- **Done:** `schemaDemo` ([`schema-demo`](../schema-demo/module.f.mjs)) is the
  demo as a factory; each `schemas/` page has its `sample.f.mjs`, `demo.f.mjs`
  and proof, and the root demo's lessons are assembled from the pages by
  [`guide/schemas/module.f.mjs`](../guide/schemas/module.f.mjs).
- **Done:** the `readers/` area, with a demo for each page that has a value to
  show, and the root demo's lessons grouped by area.
- **Done:** the `outputs/` area: the TypeScript type, JSON Schema and the
  data form, a lesson and a demo each.
- Move `in-the-project/`.
- Shrink the root README to the index, as `spec/README.md` became.

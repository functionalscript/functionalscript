## `@module` on existing `types.ts` files contradicts the header convention

**Priority:** P3
**Status:** open

### Problem

`fjs/AGENTS.md` §2 reserves the `@module` tag for a package's entry-point file
(`module.f.mjs` / `module.mjs`) and explicitly excludes `types.ts`. Yet the
pre-existing `types.ts` files across the repository — all 23 under
`fjs/types/*/types.ts`, plus others such as `fjs/effects/types.ts` — carry
`@module` in their header block.

New helper type files (`types.ts` / `private.ts`) added since the private-type
migration follow the documented rule and carry no `@module`; the older files
were left as found so that the migration did not widen.

### Tasks

- [ ] Decide which side is right: strip `@module` from the existing non-entry
      `.ts` files, or narrow `fjs/AGENTS.md` §2 if `types.ts` files are meant
      to be documented entry points.
- [ ] Apply the decision consistently across the repository.

### Related

- [`../AGENTS.md`](../AGENTS.md) — §2 module-header convention.

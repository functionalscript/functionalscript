## RTTI: one source of truth for `Unknown` / `Primitive`

**Priority:** P3
**Status:** open

### Problem

`fs/types/rtti/ts/module.f.ts` deliberately defines its own `Primitive` and
`Unknown` to keep `rtti` free of a dependency on `djs`. The intent is explicit in
the doc comment (`ts:28-33`):

```ts
export type Primitive = null | boolean | number | string | undefined | bigint
...
/**
 * Currently equivalent to `djs.Unknown`, but defined here to keep `rtti`
 * free [of djs].
 */
export type Unknown = Primitive | Array | Object
```

But the sibling rtti modules disagree on where these types come from:

- `fs/types/rtti/common/module.f.ts:25` — `import type { Primitive, Unknown } from '../../../djs/module.f.ts'`
- `fs/types/rtti/validate/module.f.ts:30` — `import type { Unknown } from '../../../djs/module.f.ts'`
- `fs/types/rtti/parse/module.f.ts:54` — `import type { Unknown } from '../ts/module.f.ts'`

So the same concept has two definitions in play for the same code: `parse` uses
the rtti-local one (the one the comment says exists *specifically* to avoid djs),
while `common` and `validate` reach back into `djs` for it. The
keep-rtti-free-of-djs goal stated in `rtti/ts` is therefore only half-applied,
and two sibling files import `Unknown` from different modules.

### Proposal

Pick the rtti-local `Unknown`/`Primitive` as the single source of truth and have
`common`, `validate`, and `parse` all import from it (today that is
`rtti/ts`; if `ts` is too heavy a module to depend on, lift the two types into a
small `rtti`-local types module and re-export from `ts`). This:

- removes `rtti`'s runtime-validation core (`common`, `validate`) depending on
  `djs`, which is the dependency direction `rtti/ts` says it wants to avoid, and
- makes all sibling files agree on one import.

Verify the two definitions are structurally identical before switching (the
comment asserts they are "currently equivalent"); if they have drifted, that
divergence is itself a bug this change surfaces.

### Tasks

- [ ] Confirm `djs.Unknown`/`Primitive` and `rtti/ts.Unknown`/`Primitive` are
      structurally identical.
- [ ] Point `common` and `validate` at the rtti-local definitions; keep `parse`
      as is.
- [ ] Run `npx tsc` and `fjs t`; confirm no behavioral change.

### Related

- `fs/types/rtti/ts/module.f.ts` — states the keep-rtti-free-of-djs intent.
- `fs/types/rtti/todo/parse-validate-shared-entry-loop.md` — surfaced alongside
  this while reading the parse/validate container builders.

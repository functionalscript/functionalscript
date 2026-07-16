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

So the same concept is imported from two different modules for the same code:
`parse` uses the rtti-local one (the one defined *specifically* to avoid djs),
while `common` and `validate` reach back into `djs`. The keep-rtti-free-of-djs
goal stated in `rtti/ts` is therefore only half-applied, and two sibling files
import `Unknown` from different modules.

The two types are **not** meant to be permanently identical. `rtti` describes a
broader value domain than DJS: in the future `rtti.Unknown` may include types
DJS cannot represent (for example, functions). The intended relationship is a
subset one — `djs.Unknown ⊆ rtti.Unknown` — not equality. So `rtti` must keep
its own `Unknown`/`Primitive` definition as the source of truth, and the
`rtti/ts` doc comment's "currently equivalent" wording should be updated to state
the subset relationship rather than equivalence (so a future reader doesn't
re-introduce the djs import on the assumption they match).

### Proposal

Make the rtti-local `Unknown`/`Primitive` the single source of truth for *all*
rtti modules, and have `common`, `validate`, and `parse` import from it (today
that is `rtti/ts`; if `ts` is too heavy a module to depend on, lift the two
types into a small `rtti`-local types module and re-export from `ts`). This:

- removes `rtti`'s runtime-validation core (`common`, `validate`) depending on
  `djs`, which is the dependency direction `rtti/ts` says it wants to avoid;
- makes all sibling files agree on one import; and
- positions rtti to widen `rtti.Unknown` (e.g. to admit functions) independently
  of DJS, keeping `djs.Unknown` as a subset.

This is purely a re-pointing of imports to the rtti-local definition — it is not
a "verify they are identical" exercise, because they are allowed to diverge by
design. Anywhere a value typed as `djs.Unknown` flows into an rtti function, it
is still accepted, since `djs.Unknown ⊆ rtti.Unknown`.

### Tasks

- [ ] Update the `rtti/ts.Unknown` doc comment to state `djs.Unknown ⊆
      rtti.Unknown` (subset), not "currently equivalent".
- [ ] Point `common` and `validate` at the rtti-local `Unknown`/`Primitive`;
      keep `parse` as is.
- [ ] Run `npx tsc` and `fjs t`; confirm `djs.Unknown` values still type-check
      where rtti functions consume them (subset relationship holds).

### Related

- `fs/types/rtti/ts/module.f.ts` — states the keep-rtti-free-of-djs intent.

## Name `Entity` kind discrimination once

**Priority:** P3
**Status:** open

`module.f.ts` models filesystem nodes as `Entity = readonly Vec[] | Dir | JsModule`, but the three-way discrimination is re-derived inline at twelve call sites in at least four non-identical spellings. Define three predicate helpers next to the `Entity` type:

```ts
const isBinFile  = (e: Entity): e is readonly Vec[] => e instanceof Array
const isJsModule = (e: Entity): e is JsModule       => typeof e === 'function'
const isDir      = (e: Entity): e is Dir            => typeof e === 'object' && !(e instanceof Array)
```

These narrowing predicates are safe (each body is the exact structural check defining membership in the asserted type), and they remove all the `as Dir` / `as readonly Vec[]` casts currently scattered across the file.

### Tasks

- [ ] Add `isBinFile`, `isJsModule`, `isDir` next to the `Entity` type.
- [ ] Rewrite the twelve inline kind-tests to use them; remove all `as Dir` / `as readonly Vec[]` casts.
- [ ] Run `npx tsc` and `fjs t`; confirm `proof.f.ts` still passes.

### Related

- A sibling cleanup: `result[0] === 'error'` short-circuit is hand-written four times (`:192`, `:225`, `:237`, `:244`). A small `propagateError` helper would clean this up, but is out of scope here.

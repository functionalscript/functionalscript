## Investigate export lists

**Priority:** P4
**Status:** open

### Problem

JavaScript can export existing bindings separately from their declarations:

```js
const x = 5;
export { x };
```

This syntax is separate from implemented [`export const`](../modules/exports/README.md).
The generic AST and FunctionalScript admission currently refuse export lists.
The [website demo](../../fjs/website/demo/module.f.mjs) forwards existing control
functions using aliased imports and declaration exports instead.

### Proposal

Desugar export lists for immutable FunctionalScript bindings into existing
declaration exports. An imported binding needs a fresh internal name:

```js
import { a } from './x.f.js';
export { a };
```

becomes, schematically:

```js
import { a as $0 } from './x.f.js';
export const a = $0;
```

`$0` is illustrative: generated names must avoid collisions. Rename references
by resolved binding identity, including captured references, while preserving
shadowed bindings and property names. Export aliases must not introduce local
bindings that change what the source resolves. Preserve value identity and
initializer evaluation order/count; an export list does not read its bindings
at its textual position, so forward exports and temporal dead zones need care.

Keep export-list syntax in the generic AST and normalize it at FunctionalScript
admission. This proposal uses FJS's immutable bindings and acyclic modules;
snapshotting arbitrary JavaScript or TypeScript live exports into constants
would change their behavior.

The benefit is familiar JavaScript syntax and module forwarding through the
existing export representation, without another execution operation. The cost
is binding-aware renaming and proofs for name collisions, scope and
initialization timing.

The language designer `sergey-shandar` requested this desugaring direction and
the manual demo rewrite in the
[working session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
Export-list parsing and automatic desugaring remain future implementation work.

### Tasks

- [ ] Investigate local export lists, aliases such as `export { x as y }`,
      and `export { x as default }`. Identify concrete uses and compare them
      with declaration exports.
- [ ] Retain export specifiers in the generic AST and implement binding-aware
      desugaring for the agreed immutable FJS scope, with collision-free names.
- [ ] Prove value identity, lexical binding/capture behavior, duplicate/export
      name checks and initializer timing, including forward export lists.
- [ ] Consider whether forms with `from` (re-exports) belong in the proposed
      scope or need a separate task.
- [ ] Describe the implications for binding resolution and the module result
      object, then propose a scope for owner review before implementation.

### Related

- [Named exports](../modules/exports/README.md).

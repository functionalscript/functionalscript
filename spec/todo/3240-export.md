## Named exports

**Priority:** P1
**Status:** open

### Problem

FSC requires one final `export default`. Existing FunctionalScript modules use
named exports: compiling the dependency-free
[`types/range`](../../fjs/types/range/module.f.mjs) module unchanged at
`3552bca74723a79037e05d0906f3446bffee993e` fails with `unexpected token` at
`const` in its first export:

```js
export const contains = (b, e) => i => b <= i && i <= e
```

This is the first observed blocker for that candidate in the
[compiler-compatibility migration](../../todo/fjs-nanvm-integration.md).
Supporting named exports does not establish that the rest of the file compiles.

### Proposal

Start with `export const name = expression;`, using the existing `const`
binding and expression rules. An exported constant is also a local binding;
later declarations may refer to it. Imports stay first, and ordinary and
exported constants may appear together in declaration order.

```js
const base = 17;
export const first = base;
export const second = first;
```

Represent a module's exports by name, with `default` as the name of its default
export. Keep this export table distinct from a default-exported object:

| Source | Export table |
| --- | --- |
| `export default { first: 17 };` | `{ default: { first: 17 } }` |
| `export const first = 17;` | `{ first: 17 }` |

The table describes compiler linkage; it is not a claim that an ordinary object
has JavaScript module-namespace semantics. A default import selects `default`
and fails if that export is absent. It must never receive the whole export table
as a substitute. JSON imports continue to expose their document as `default`.

Named and default exports may coexist, as confirmed by the owner:

```js
export const x = 5;
export default 7;
```

Its export table is `{ x: 5, default: 7 }`. Keep `export default` last under
the existing statement-order rule. A named-only module needs no default export.

Preserve every declaration's evaluation and the sharing between exported
bindings. Report duplicate bindings/exports at their source locations.
Retain the existing design's reservation of the export name `then`, regardless
of its value: a callable `then` on a namespace interferes with dynamic import's
promise resolution.

Namespace imports belong to the separate
[namespace-import TODO](./2220-namespace-import.md). Investigating `export { ... }`
belongs to the separate, low-priority [export-list TODO](./export-lists.md).
Re-exports and new expression or function syntax are outside this first step.

### Output contract to settle

FSC currently lowers a module to one exported value/EDAG. Named exports require
the export table to survive parsing, linking, and module output; accepting the
syntax alone is insufficient.

Propose preserving export names in generated JavaScript and retaining the
default value for JSON and DataJS value outputs, with a diagnostic when no
default exists. Decide how the EDAG and Rust entry-point APIs expose named
exports before changing them. Do not silently emit a default-exported object
where the source declared named exports.

### Tasks

- [x] Allow named and default exports in the same module.
- [ ] Agree on the output contract above; record the selected module-result
      shape and affected APIs here.
- [ ] Implement `export const` through the grammar, AST, and linking, preserving
      local references, evaluation order, sharing, and export names. Add proofs
      for named-only and mixed modules, duplicate names, reserved `then`,
      and a default import of a module without a default export.
- [ ] Carry that result through the affected output paths. Prove generated
      JavaScript exposes the same exports and values as the original source,
      and preserve default-export and JSON-import behavior.
- [ ] Retry the unchanged `types/range/module.f.mjs`. If it fails, show the next
      diagnostic to the owner, who chooses a source rewrite or a missing
      compiler feature. Rename it to `.f.js` only after full compilation succeeds.
- [ ] Move the implemented contract into the specification and compiler docs,
      then remove this TODO.

### Related

- [Current export contract](../README.md#exporting-a-value).
- [Compiler entry points](../../fjs/fsc/module.f.mjs).
- [Namespace imports](./2220-namespace-import.md).

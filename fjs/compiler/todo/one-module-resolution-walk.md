## one-module-resolution-walk. The transpiler and the linker walk imports the same way twice

**Priority:** P3
**Status:** open

### Problem

`foldNextModuleOp` in [`transpiler`](../transpiler/module.f.mjs) and `link`
in [`edag`](../edag/module.f.mjs) both check attributes, reject cycles, reuse
completed module identities, then read JSON or parse and follow source imports.

Their contexts are one type written twice, `ParseContext` in the
transpiler's public `types.ts` and `_Link` in the linker's `private.ts`,
differing only in what `complete` memoises: the transpiler's
represented `EdagValue` export object against the linker's `_Resolved`,
a complete computation graph beside cached export selections.
The readers below the walk are already shared — the
[`source`](../source/module.f.mjs) exports the source-resolution, parsing,
attribute and missing-export helpers for both paths — which is the
half-finished state: every rule about *reading* a module has one owner, and
every rule about *walking* the graph has two. [module-resolution-compatibility](./module-resolution-compatibility.md)
is what that costs: each semantics fix — percent decoding, host identity,
attribute mismatch, invalid specifiers — landed in both paths.

Separately, `ParseContext` is referenced only inside the transpiler's own
module, so it is in the public `types.ts` for no reader.

### Proposal

One walk, beside the shared source readers, parameterised
over the two things that differ — what a JSON document becomes, and what a
parsed module becomes once its imports are bound:

```ts
/** A complete module and its cached export selections. */
type _Module<T> = {
    readonly exports: T
    readonly bindings: readonly (readonly [string, T])[]
}
type _Context<T> = { readonly complete: OrderedMap<_Module<T>>, readonly stack: List<string> }
const _walk: <T>(
    onJson: (value: JsonUnknown) => _Module<T>,
    onModule: (source: _Source, bound: readonly (readonly [_ImportSource, _Module<T>])[], module: AstModule) => Effect<ReadWhole | ResolveFileModule, _Module<T>, ParseError>,
) => (source: _Source) => (context: _Context<T>) => Effect<ReadWhole | ResolveFileModule, readonly [_Context<T>, _Module<T>], ParseError>
```

The walk memoises the **complete module**, never a bare selected value.
`T` is `EdagValue` for interpretation and `Exp` for linking. The interpreter
currently caches a represented complete export object and selects its properties;
the linker caches `_Resolved` with explicit selections. Choose a common selection
interface without copying represented values. A root returns the complete result;
JSON imports wrap the represented document under `default`. A direct JSON root
remains a document. The source arms reuse EDAG memo interpretation and
`lowered`/`completed`, respectively; there is no AST evaluator to retain.

`bound` pairs each complete result with its `_ImportSource`, in import order.
This retains the host identity, child diagnostic path, JSON attribute and
selected exported `name`; a local alias has already become an AST binding.
`name === null` denotes an empty import list: retain the full module's
evaluation anchor without requiring any export. Otherwise, require a matching
export property or binding entry even when the local is unused, and report `_missingExport(source)`
against the **child's** path. Presence means the property exists, not that its
selected value differs from `undefined`.

Check each selection during dependency folding, before processing the next
import, including cache hits. Repeated and diamond imports must reuse the
same module and cached selections, preserving per-selection values and
EDAG evaluation anchors. One `_Context<T>` replaces both context types;
`ParseContext` leaves `types.ts` in the same change.

This consolidation does not by itself separate linking from value evaluation.
The case where a missing export and a failing initializer belong to the same
dependency remains tracked in
[import-error-before-evaluation](./import-error-before-evaluation.md).

[interpret-edag](./interpret-edag.md) has retired the AST value evaluator
without introducing a third walk. This consolidation remains independent of
callable runtime compilation and must carry initialization failures' represented
payloads and source paths as well as parse failures.

### Tasks

- [ ] `_walk`, `_Module<T>` and `_Context<T>` in the transpiler; `transpile` and
      `resolve` become the two instantiations; `_Link` and `ParseContext`
      go.
- [ ] `tsc`, `fjs test`; both modules' proofs pass unchanged, including
      cycles, attributes, missing versus `undefined` exports, empty lists,
      per-selection values, repeated/diamond imports and the earlier-import
      diagnostic-ordering cases on both paths.

### Related

- [module-resolution-compatibility.md](./module-resolution-compatibility.md) —
  requires the two paths to agree; one path makes agreement structural.
- [compile-modules-to-edag.md](./compile-modules-to-edag.md) — landed the
  linker "alongside" the transpiler and ratified the shared readers; this
  finishes that sharing.
- [cache-compiled-modules.md](./cache-compiled-modules.md) — touches
  `resolve`'s binding only.

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
`ModuleDenotation` against the linker's `_Resolved`, each a module's
`exports` beside its `bindings` table of exported names and selected results.
The readers below the walk are already shared — the
transpiler exports `_rootSource`, `_importSources`, `_parseModule`,
`_parseJson`, `_attributeError` and `_missingExport` for the linker to use — which is the
half-finished state: every rule about *reading* a module has one owner, and
every rule about *walking* the graph has two. [module-resolution-compatibility](./module-resolution-compatibility.md)
is what that costs: each semantics fix — percent decoding, host identity,
attribute mismatch, invalid specifiers — landed in both paths.

Separately, `ParseContext` is referenced only inside the transpiler's own
module, so it is in the public `types.ts` for no reader.

### Proposal

One walk, exported from the transpiler beside its readers, parameterised
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
    onModule: (source: _Source, bound: readonly (readonly [_ImportSource, _Module<T>])[], module: AstModule) => Effect<ReadFile | ResolveFileModule, _Module<T>, ParseError>,
) => (source: _Source) => (context: _Context<T>) => Effect<ReadFile | ResolveFileModule, readonly [_Context<T>, _Module<T>], ParseError>
```

The walk memoises the **complete module**, never a bare selected value.
`T` is `Denotation` for the transpiler and `Exp` for the linker;
`_Module<Denotation>` and `_Module<Exp>` have the current `ModuleDenotation`
and `_Resolved` shapes. A root returns `exports`; an import selects a cached
entry from `bindings`. `default` is an ordinary exported name, not a separate
cache field. `onJson` returns the same shape as `onModule`: the transpiler uses
`{ exports: jsonDenotation({ default: value }), bindings: [['default', jsonDenotation(value)]] }`.
The linker builds the full JSON export object and caches its `default`
selection as `completedJson` does today. JSON object keys are not exports.
The source arms reuse `values`/`done` and `lowered`/`completed`, respectively.

`bound` pairs each complete result with its `_ImportSource`, in import order.
This retains the host identity, child diagnostic path, JSON attribute and
selected exported `name`; a local alias has already become an AST binding.
`name === null` denotes an empty import list: retain the full module's
evaluation anchor without requiring any export. Otherwise, require a matching
binding entry even when the local is unused, and report `_missingExport(source)`
against the **child's** path. Presence means an entry exists, not that its
selected value differs from `undefined`.

Check each selection during dependency folding, before processing the next
import, including cache hits. Repeated and diamond imports must reuse the
same module and cached selections, preserving per-selection sharing facts and
EDAG evaluation anchors. One `_Context<T>` replaces both context types;
`ParseContext` leaves `types.ts` in the same change.

This consolidation does not by itself separate linking from value evaluation.
The case where a missing export and a failing initializer belong to the same
dependency remains tracked in
[import-error-before-evaluation](./import-error-before-evaluation.md).

[interpret-edag](./interpret-edag.md) would retire the transpiler's
evaluator eventually; it is open, and it says nothing about the walk. A
shared walk is the cheaper step and makes that retirement smaller.

### Tasks

- [ ] `_walk`, `_Module<T>` and `_Context<T>` in the transpiler; `transpile` and
      `resolve` become the two instantiations; `_Link` and `ParseContext`
      go.
- [ ] `tsc`, `fjs test`; both modules' proofs pass unchanged, including
      cycles, attributes, missing versus `undefined` exports, empty lists,
      per-selection sharing, repeated/diamond imports and the earlier-import
      diagnostic-ordering cases on both paths.

### Related

- [module-resolution-compatibility.md](./module-resolution-compatibility.md) —
  requires the two paths to agree; one path makes agreement structural.
- [compile-modules-to-edag.md](./compile-modules-to-edag.md) — landed the
  linker "alongside" the transpiler and ratified the shared readers; this
  finishes that sharing.
- [cache-compiled-modules.md](./cache-compiled-modules.md) — touches
  `resolve`'s binding only.

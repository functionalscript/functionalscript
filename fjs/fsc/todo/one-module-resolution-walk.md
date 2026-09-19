## one-module-resolution-walk. The transpiler and the linker walk imports the same way twice

**Priority:** P3
**Status:** open

### Problem

`foldNextModuleOp` in [`transpiler`](../transpiler/module.f.mjs) and `link`
in [`edag`](../edag/module.f.mjs) are the same five steps in the same order,
down to the shared comment:

```js
// transpiler, foldNextModuleOp                       // edag, link
const mismatch = _attributeError(source)              const mismatch = _attributeError(source)
if (mismatch !== null) { return pureError(mismatch) } if (mismatch !== null) { return pureError(mismatch) }
if (includes(id)(context.stack)) {                    if (includes(id)(context.stack)) { return pureError({ message: 'circular dependency', metadata: null, path }) }
    return pureError({ message: 'circular dependency', metadata: null, path })
}                                                     const done = at(id)(context.complete)
if (at(id)(context.complete) !== null) {              if (done !== null) { return pureOk([context, done[0]]) }
    return pureOk(context)                            const entered = { ...context, stack: { first: id, tail: context.stack } }
}
if (json) { return mapStep(_parseJson(path), jsonDone(id, context)) }
                                                      return json
return step(_parseModule(path),                           ? mapStep(_parseJson(path), completedJson(id)(entered))
    module => transpileWithImports(source)(module)(context))  : step(_parseModule(path), linkModule(source)(entered))
```

and their contexts are one type written twice, `ParseContext` in the
transpiler's public `types.ts` and `_Link` in the linker's `private.ts`,
differing only in what `complete` memoises (`Denotation` against
`readonly [Exp]`). The readers below the walk are already shared — the
transpiler exports `_rootSource`, `_importSources`, `_parseModule`,
`_parseJson` and `_attributeError` for the linker to use — which is the
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
type _Context<T> = { readonly complete: OrderedMap<readonly [T]>, readonly stack: List<string> }
const _walk: <T>(
    onJson: (value: JsonUnknown) => T,
    onModule: (source: _Source, bound: readonly T[], module: AstModule) => Effect<ReadFile | ResolveFileModule, T, ParseError>,
) => (source: _Source) => (context: _Context<T>) => Effect<ReadFile | ResolveFileModule, readonly [_Context<T>, T], ParseError>
```

The transpiler's arm supplies `jsonDenotation` and the body that evaluates
`values`; the linker's supplies `jsonEdag` and `lowered`. One `_Context<T>`
replaces both context types — the one-tuple box `_Link` already uses for a
possibly-`null` EDAG is harmless for a `Denotation`. `ParseContext` leaves
`types.ts` in the same change.

[interpret-edag](./interpret-edag.md) would retire the transpiler's
evaluator eventually; it is blocked, and it says nothing about the walk. A
shared walk is the cheaper step and makes that retirement smaller.

### Tasks

- [ ] `_walk` and `_Context<T>` in the transpiler; `transpile` and
      `resolve` become the two instantiations; `_Link` and `ParseContext`
      go.
- [ ] `tsc`, `fjs test`; both modules' proofs pass unchanged, including
      the circular-dependency and attribute-mismatch cases on both paths.

### Related

- [module-resolution-compatibility.md](./module-resolution-compatibility.md) —
  requires the two paths to agree; one path makes agreement structural.
- [compile-modules-to-edag.md](./compile-modules-to-edag.md) — landed the
  linker "alongside" the transpiler and ratified the shared readers; this
  finishes that sharing.
- [cache-compiled-modules.md](./cache-compiled-modules.md) — touches
  `resolve`'s binding only.

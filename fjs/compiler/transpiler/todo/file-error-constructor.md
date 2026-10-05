## file-error-constructor. A file-level `ParseError` literal is built at about ten sites

**Priority:** P5
**Status:** open

### Problem

An error about a file rather than a token — not found, not UTF-8, no such
export, a bad import attribute — is a `ParseError` with no position, and
the rule "no position" is restated as `metadata: null` wherever one is
made: `notFound`, `readSource`, `sourceAt`, `_importSources`,
`transpileWithImports`, `foldNextModuleOp`, `_attributeError`,
`_missingExport` and `_parseJson` in [`module.f.mjs`](../module.f.mjs),
and `link` in [`edag`](../../edag/module.f.mjs):

```js
// notFound
catchStep(e, () => pureError({ message: 'file not found', metadata: null, path }))
// readSource
pureError({ message: 'not UTF-8 text', metadata: null, path })
// _missingExport
export const _missingExport = ({ path, name }) => ({ message: `module has no ${name} export`, metadata: null, path })
```

### Proposal

One constructor, exported from the transpiler or from
[`parser/types.ts`](../../parser/types.ts) next to `ParseError`:

```ts
/** An error about a file, not a token: it has a path and no position. */
export const _fileError: (path: string) => (message: string) => ParseError
```

Each site calls `_fileError(path)(message)` for the value and keeps the
wrapper it has: `pureError(…)` where it is a failed effect today,
`error(…)` inside the `Result` that `_parseJson` hands to `pure`, and
the bare value in `_attributeError`, which answers `ParseError | null`,
and `_missingExport`, whose callers wrap it themselves. The exported
signatures do not change; only the literal does.

### Tasks

- [ ] `_fileError`; the sites through it, each keeping its wrapper
      and its signature.
- [ ] `tsc`, `fjs test`.

### Related

- [one-module-resolution-walk](../../todo/one-module-resolution-walk.md)
  — the shared `'circular dependency'` site and the root dispatch
  belong to that walk; this is only the constructor.

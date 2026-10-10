## `asyncImport` builds a file URL by hand

**Priority:** P4
**Status:** open

### Problem

`asyncImport` in [`module.mjs`](../module.mjs) turns a name into something
`import()` accepts with two string tests: `v.includes(':') ? v :
concat(process.cwd())(v)`, then prefix `file:///` unless already present.
The `resolveFileModule` operation in the same map does the same job through
`pathToFileURL`, `new URL(name, parent)` and `fileURLToPath`.

The hand-built version classifies a name as a URL by whether it holds a
colon, which is path-classification logic in a host `.mjs`, and it is
wrong at the edges: a relative POSIX name holding `:` is read as a URL, and
an absolute POSIX path is prefixed to `file:////…`, which works by the
accident of URL normalization.

### Proposal

`asyncImport` goes through `pathToFileURL(resolve(v))`, or shares the
resolution `resolveFileModule` already performs. If any classification is
still needed, it belongs in [`fjs/path`](../../../path/module.f.mjs), not
here.

### Tasks

- [ ] One file-URL construction for both; `node --test` to exit 0.

### Related

- [node-module-layering](../../todo/node-module-layering.md) — names
  `asyncImport` as the `import` implementer.

## `asyncImport` builds a file URL by hand

**Priority:** P4
**Status:** open

### Problem

`asyncImport` in [`module.mjs`](../module.mjs) turns a name into something
`import()` accepts with string tests: `v.includes(':') ? v :
concat(process.cwd())(v)`, then prefix `file:///` unless already present.
The `resolveFileModule` operation in the same map already uses
`pathToFileURL`, `new URL(name, parent)` and `fileURLToPath`, but its input
contract differs: with `parent === null`, the name is a literal filesystem
path; otherwise it is an admitted import relative to a parent identity.

`asyncImport` also accepts an already-formed `file:` URL, as the `import`
proof in [`proof.mjs`](../proof.mjs) exercises. Treating that URL text as a
filesystem path would break a supported input.

The hand-built version classifies a name as a URL by whether it holds a
colon, which is path-classification logic in a host `.mjs`, and it is
wrong at the edges: a relative POSIX name holding `:` is read as a URL, and
an absolute POSIX path is prefixed to `file:////…`, which works by the
accident of URL normalization.

### Proposal

Keep already-formed `file:` URLs as URLs, preserving their escaped path,
query and fragment. Resolve relative filesystem paths against the working
directory and construct their URLs with `pathToFileURL`; do the same
conversion for absolute paths. For example, `file:///tmp/x.mjs` must never
be passed to `resolve` or `pathToFileURL` as filesystem-path text.

Share the host URL-conversion mechanics with `resolveFileModule` where
their contracts agree. Its `parent === null` branch immediately calls
`pathToFileURL(name)`, so reusing that branch for a file URL is not a valid
replacement. Keep its literal entry-path contract, parent-relative import
admission and realpath identity behavior intact.

Any pure path classification belongs in
[`fjs/path`](../../../path/module.f.mjs); Node URL parsing and conversion
remain in the host adapter.

### Tasks

- [ ] Replace the hand-built URL with shared host conversion, preserving
      each operation's input contract.
- [ ] Prove relative and absolute paths, path characters needing URL
      escaping, and already-formed file URLs with escapes, query and
      fragment; retain the existing file-URL import proof.
- [ ] `node --test` to exit 0.

### Related

- [node-module-layering](../../todo/node-module-layering.md) — names
  `asyncImport` as the `import` implementer.

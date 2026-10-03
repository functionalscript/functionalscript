## file-cas-shard-path. `fileCas` spells the shard path twice and `read` copies `streamFile`

**Priority:** P5
**Status:** open

### Problem

In [`module.f.mjs`](../module.f.mjs), `fileCas`'s `read` and `url` both
compute where a hash lives on disk, and `read` then streams the file by
hand although `streamFile`, a few lines below, is that stream:

```js
// fileCas.read
const p = join(path, toPath(hash))
return readChunks((offset, size) => readBytes(p, offset, size), null)
// streamFile
const streamFile = filePath => readChunks((offset, size) => readBytes(filePath, offset, size), null)
// fileCas.url
url: hash => join(path, toPath(hash))
```

### Proposal

Inside `fileCas`, `const at = hash => join(path, toPath(hash))`, then
`read: hash => streamFile(at(hash))` and `url: at`. One function then
owns "stream a file in chunks" and one owns "where a hash lives".

### Tasks

- [ ] `at`; `read` and `url` through it and `streamFile`.
- [ ] `tsc`, `fjs test`.

### Related

- [66k-cas-cli-mcp-shared-core](./66k-cas-cli-mcp-shared-core.md) —
  names `streamFile` as the machinery the CLI and the server share.
- [stage-lease-path](./stage-lease-path.md) — the staging path, the
  other path this module computes.

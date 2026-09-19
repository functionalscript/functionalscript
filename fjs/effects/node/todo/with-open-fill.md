## with-open-fill. Three descriptor handlers repeat the open/close bracket and the fill loop

**Priority:** P4
**Status:** open

### Problem

In `fjs/effects/node/module.mjs`, the `readBytes`, `readWhole` and
`writeBytes` handlers each open a descriptor in a `try`/`finally` that
closes it, and two of them fill a buffer with the same short-read loop:

```js
// readBytes
while (taken < size) {
    const { bytesRead } = await fh.read(buffer, taken, size - taken, offset + taken)
    if (bytesRead === 0) { break }
    taken += bytesRead
}
// readWhole — "filled rather than read once, for the reason the note on readBytes gives"
while (taken < buffer.length) {
    const { bytesRead } = await fh.read(buffer, taken, buffer.length - taken)
    if (bytesRead === 0) { break }
    taken += bytesRead
}
```

`writeBytes` is the write mirror. The short-read invariant the long note
on `readBytes` defends, with measured evidence, is one function's business
and lives in two copies plus a cross-reference.

### Proposal

Two runner-private helpers, the way the `io` wrapper above them puts the
`catch` in one place: `withOpen(path, flags)(f)` for the bracket and
`fill(fh, buffer, position)` for the loop, `position` `null` for the
cursor-walking read `readWhole` needs. Each handler is then its own
content: the size guards, the chunk accumulation, the `Vec` conversion.

### Tasks

- [ ] `withOpen` and `fill`; the three handlers over them; the note moves
      to `fill`.
- [ ] `tsc`, `fjs test`.

### Related

- [write-from-stream-finalize.md](./write-from-stream-finalize.md) — the
  neighbouring handler's cleanup; unaffected.

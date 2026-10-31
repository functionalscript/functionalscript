## One digest fold for `contentKey` and `cas git`

**Priority:** P4
**Status:** open

### Problem

The content-key rule — whole bytes only, SHA-2 over the chunks, one refusal
for a partial byte — is written in [`module.f.mjs`](../module.f.mjs) and
again in [`git/module.f.mjs`](../git/module.f.mjs):

```js
// cas: `partialByte`, `digested` behind `contentKey`
const partialByte = pureError(ioError({ message: 'invalid buffer size' }))
const digested = (sha2, state, s) => ioStep(s, node => {
    if (node === undefined) { return pureOk(sha2.end(state)[2]) }
    return isWholeBytes(node.first) ? digested(sha2, sha2.update(state, node.first)[2], node.tail) : partialByte
})
// cas/git: `partialByte`, `gathered` behind `branchCas`
const partialByte = pureError(ioError({ message: 'invalid buffer size' }))
const gathered = (sha2, payload) => { const loop = (state, chunks) => s => step(s, node => {
    if (node === undefined) { return pureOk({ key: sha2.end(state)[2], chunks }) }
    return isWholeBytes(node.first) ? loop(sha2.update(state, node.first)[2], [...chunks, node.first])(node.tail) : partialByte }) … }
```

The doc comments point at each other — `gathered` is "the hash `fileCas`
folds over the same chunks", `partialByte` is what "`fileCas.write` and
`contentKey` refuse it with" — which is the rule that a `cas git` key equals
a `fileCas` key, held by prose rather than by code.

### Proposal

Export the fold from `fjs/cas` and have `cas/git` use it: a
`digestFold(sha2)` that threads a caller's accumulator over each whole chunk
and answers `partialByte` otherwise, or `partialByte` plus a `wholeChunk`
step. `contentKey`, `gathered` and `writeImpl`'s loop then share it.
[streaming-writes](../git/todo/streaming-writes.md) would drop the gathered
chunks, leaving `gathered` identical to `digested`, so the two may well
collapse into one export.

### Tasks

- [ ] The fold exported from `fjs/cas` with its proof.
- [ ] `contentKey`, `cas/git`'s `gathered`, `writeImpl` over it.

### Related

- [abstract-write](./abstract-write.md) — `writeFromStream` against
  `fileCas.write`'s loop; the same fold.
- [streaming-writes](../git/todo/streaming-writes.md) — removes the chunk
  accumulator from `gathered`.

## tool-step. A `toolStep` is missing beside `toolResultStep`

**Priority:** P4
**Status:** open

### Problem

`toolResultStep` in [`module.f.mjs`](../module.f.mjs) owns the *terminal*
form of "a failure becomes an `isError` result": it calls itself the third
member of the `okResult`/`errorResult` family. The non-terminal form — the
chain continues after the success — has no member, so the CAS tools write
it by hand:

```js
// fjs/mcp/cas/module.f.mjs, cas_add
resultStep(c.write(…), writeResult => {
    if (writeResult[0] === 'error') { return pureOk(errorResult('write')) }
    …
// cas_get, twice, with the same sentence
resultStep(detectStream(c.read(key)), ([tag, detected]) => {
    if (tag === 'error') { return pureOk(errorResult(`no such hash: ${r.hash}`)) }
    …
resultStep(collectRead(c.read(key)), ([collectTag, value]) => {
    if (collectTag === 'error') { return pureOk(errorResult(`no such hash: ${r.hash}`)) }
```

### Proposal

`toolStep(e, errorText, onOk)`: `resultStep` whose error branch is
`pureOk(errorResult(errorText(err)))` and whose ok branch is the caller's
continuation, with the same argument `toolResultStep` makes for keeping
`errorText` required. The three sites collapse to their content.
[66k](../../../cas/todo/66k-cas-cli-mcp-shared-core.md) moves most of
`cas_get`'s body into `fjs/cas`; its sketch of the adapter that remains
opens with the same `resultStep`/`errorResult` line, so the combinator
survives that move.

### Tasks

- [ ] `toolStep` with a proof of both branches; the three sites over it.
- [ ] `tsc`, `fjs test`.

### Related

- [validated-envelope.md](./validated-envelope.md) — `validated`/`toolMethod`,
  one layer above, inside `mcpStep`.
- [`../../../cas/todo/66k-cas-cli-mcp-shared-core.md`](../../../cas/todo/66k-cas-cli-mcp-shared-core.md) —
  the policy duplication in the same handlers.

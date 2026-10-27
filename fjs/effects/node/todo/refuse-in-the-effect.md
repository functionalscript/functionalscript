## Refuse in the effect, not in every runner

**Priority:** P3
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) already knows how to keep a refusal out of
the runners: `writeBytes` is a wrapper over the raw `do_('writeBytes')`
operation that asks `writeRefusal` first and answers `pureError` itself, so
the Node runner, the virtual runner and the native one each see only a write
a host will perform. Two other refusals are not wrapped, and so are written
once per runner instead:

- **The read window.** `readBytes` and `pread` are raw `do_` operations.
  `windowRefusal` is exported so that the Node runner's `refuseWindow` in
  [`module.mjs`](../module.mjs) and the virtual runner's `window_` in
  [`virtual/module.f.mjs`](../virtual/module.f.mjs) can each ask it; the
  native runner, which cannot import it, re-derives the whole check as
  `window_refusal` and `check_window` in
  [`nanvm/effects-node/src/files.rs`](../../../../nanvm/effects-node/src/files.rs),
  with a `number_text` call to reproduce JavaScript's number formatting and
  a unit test pinning the JavaScript wording. `windowRefusal`'s own JSDoc
  states the problem — "`readBytes` and `pread` each have two
  implementations … a bound checked in one of the four is a window a proof
  passes and production refuses" — and undercounts it, since the native
  runner is a third.
- **The empty host.** `listen` is a raw `do_` operation. `emptyHost`,
  `emptyHostCode`, `emptyHostMessage` and `emptyHostError` are exported so
  the Node runner can throw an `Error` from the two literals and the virtual
  runner can answer `error(emptyHostError)`; the `emptyHostError` doc says
  this arrangement "is what keeps the two from drifting apart", and the
  virtual runner's comment records that they once did, over which check
  runs first.

A rule the effect states once cannot be forgotten by a runner, cannot be
ordered differently by two of them, and needs no proof per runner.

### Proposal

Wrap both the way `writeBytes` is wrapped:

```js
const readBytesOp = do_('readBytes')
export const readBytes = (path, offset, size) => {
    const refusal = windowRefusal(offset, size)
    return refusal === null ? readBytesOp(path, offset, size) : pureError(ioError({ message: refusal }))
}
// `pread` the same; and
const listenOp = do_('listen')
export const listen = (server, port, host) =>
    host === emptyHost ? pureError(emptyHostError) : listenOp(server, port, host)
```

Then delete what the wrappers make unreachable: `refuseWindow` and its two
call sites in the Node runner; the check at the top of `window_`, which keeps
only its slicing; the `emptyHost` branches in both runners; and in Rust
`window_refusal`, `check_window`, the early return in the native `pread` arm
and the `window_refusals` test. `windowRefusal` and `emptyHostError` stay
exported for their proofs; `emptyHostCode` and `emptyHostMessage` can become
literals inside `emptyHostError` once no runner spells them.

`isPort` stays in the virtual runner: Node checks it after
`ERR_SERVER_ALREADY_LISTEN`, which depends on runner state, so it cannot move
ahead of the host.

### Tasks

- [ ] `readBytes`, `pread` and `listen` as wrappers; their proofs cover the
      refusal branch once, in `fjs/effects/node`.
- [ ] Remove the per-runner checks in `module.mjs`, `virtual/module.f.mjs`
      and `nanvm/effects-node/src/{files,native}.rs`; the parity corpus
      still passes.
- [ ] Rewrite `windowRefusal`'s and `emptyHostError`'s JSDoc: they are now
      asked once, by the effect.

### Related

- [virtual-error-codes](../virtual/todo/virtual-error-codes.md) — the
  failures the two runners still answer differently.
- [filesystem-error-codes](../../../../nanvm/effects-node/todo/filesystem-error-codes.md)
  — the native runner's parity, which this shortens.
- [generated-shared-constants](../../../../nanvm/effects-node/todo/generated-shared-constants.md)
  — the constants the native runner copies by hand, fewer after this.

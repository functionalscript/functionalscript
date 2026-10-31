## Share the CAS upload digest driver

**Priority:** P4
**Status:** open

### Problem

The content-key rule — whole bytes only, SHA-2 over the chunks, one refusal
for a partial byte — now has shared parts:
[`wholeByteMachine`](../module.f.mjs) admits each input inside the update of
`contentKey` and [`gathered`](../git/module.f.mjs), and both run directly on the
source through the common [`EffectList` machine driver](../../effects/list/module.f.mjs).
The old `digested` and `gathered` loops have gone; no recursive source wrapper is
needed before the driver's stack-safe walk.

`writeImpl` still advances the same hash lifecycle inside its upload loop,
interleaving `writeBytes`, lease renewal, and cleanup on failure. Its driver
cannot be replaced by a pure fold without preserving those effects and the
staging path and offset needed when the upload finishes.

### Proposal

Complete the driver consolidation with `writeImpl`, retaining streaming writes,
lease renewal, and failure cleanup. Its byte admission currently belongs to
`writeBytes`, whose refusal is also the one `wholeByteMachine` reports. Share the
driver where it can carry that effectful upload state without buffering output.
[streaming-writes](../git/todo/streaming-writes.md) would drop the gathered
chunks, leaving `gathered` as the same hash-only machine as `contentKey`.

### Tasks

- [x] Share the stream's whole-byte admission and the generic machine driver.
- [x] Run `contentKey` and `cas/git`'s `gathered` through those shared parts.
- [ ] Consolidate `writeImpl`'s effectful upload driver while preserving its
      cleanup, staging lease, and final publication checks.

### Related

- [abstract-write](./abstract-write.md) — `writeFromStream` against
  `fileCas.write`'s loop; the same fold.
- [streaming-writes](../git/todo/streaming-writes.md) — removes the chunk
  accumulator from `gathered`.

## The body pump's byte-count decision is written once per runner

**Priority:** P3
**Status:** open

### Problem

A streamed response body is checked against its declared length as it is
pulled: a cell that fails destroys, a body that ends short of the length is
an underrun, a chunk that would pass it is an overrun, and otherwise the
chunk is taken and the count advances. Each runner makes that decision:

- `pumpBody` in [`module.mjs`](../module.mjs), for the Node runner:
  `if (bound !== null && written !== bound) { res.destroy(); return }` and
  `if (bound !== null && written + chunk.length > bound) { res.destroy();
  return }`.
- `pump` in [`virtual`](../virtual/module.f.mjs), for the virtual runner:
  `bound !== null && count !== bound ? ['underrun', bound] : null` and
  `if (bound !== null && count + got > bound) { return […, ['overrun',
  bound]] }`.

The gates before the body — `responseGate`, `carriesNoBody`,
`refusalMessage` — were moved into [`module.f.mjs`](../module.f.mjs) "so
the gate order is the design's and not each runner's". The per-cell
decision was not, so it is still each runner's, and the Node copy is
business logic in a plain `.mjs`, which [AGENTS.md
§3](../../../../AGENTS.md#3-functionalscript-and-typescript-fjs) names as
migration debt.

### Proposal

A pure `pumpCell(bound, written, cell, chunkBytes)` in `module.f.mjs`
answers a tagged decision — fail, end, underrun, overrun, or take with the
new count. The Node runner maps the tag to `destroy`, `end` and `write`;
the virtual runner maps it to its recorded response. Neither keeps a
comparison of its own.

### Tasks

- [ ] `pumpCell` with a proof at 100%, covering `null` and bounded
      lengths at each edge.
- [ ] The listed pumps over it, behaviour unchanged; `node --test` to exit 0.

### Related

- [streaming-http-bodies](./streaming-http-bodies.md) — records the virtual
  runner as mirroring the Node runner's count; this is the shared skeleton
  that mirroring wants.

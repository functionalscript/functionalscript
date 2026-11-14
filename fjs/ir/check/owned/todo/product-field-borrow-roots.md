## Product field borrow roots

**Priority:** P4
**Status:** on-hold — sound as written; defer until real IR needs the precision

### Problem

`makeTerm` builds a product as one borrow whose roots are the union of every
field's, and the `field` case forwards that whole set when the projection's
type still holds a sealed value. After `p = { x: t, y: u }` and `q = p.x`,
dropping `u` then using `q` is refused as a use after `u` was consumed, even
though `q` only holds the handle borrowed from `t` and both owners were live
at the projection. The check is sound and strict: it never accepts a leak, and
it refuses some modules that would run cleanly on the counting host, where a
product is already one local per field.

That aggregate was an explicit 6a choice (`A product holds borrows only` in
[`module.f.js`](../module.f.js)); loop parameters that are products holding a
sealed value stay refused in this slice for the same reason.

### Proposal

Give a borrowed product structured roots — one set per field, joined
field-wise on `make` — and let `field` keep only the selected field's owners.
Keep refusing a product field that consumes an owner another field still
leans on. When the lifetime pass lands, keep its product `leansOn` aligned
with the same per-field story, or leave it coarse (owners stay alive longer),
but do not make lifetime drop an owner the checker still treats as live for a
live projection.

### Tasks

- [ ] Per-field borrow roots in `makeTerm` and the `field` case, with a proof
  of the input above accepted and of a field that still outlives its owner
  refused.
- [ ] Align the lifetime pass's product `leansOn` if that pass is on `main`
  when this is taken, or note in its module why the coarse lean remains.

### Related

- [`module.f.js`](../module.f.js) — the owned-stage rules that state the
  aggregate product borrow.
- [fjs/ir: make 6a's owned-stage check sound and compilable (#3862)](https://github.com/functionalscript/functionalscript/pull/3862) —
  "Choices to confirm": a product holds borrows only.
- [Codex on #3856](https://github.com/functionalscript/functionalscript/pull/3856#discussion_r4575121786) —
  "Track the selected field's borrow roots".

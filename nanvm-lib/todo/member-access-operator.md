## Member access operator (`.` / `[]`)

**Priority:** P1
**Status:** open

### Problem

[`nanvm-lib/README.md`](../README.md)'s operator table marks `.` / `[]` as
the one basic operator still missing: "full property access still needs
prototype-chain walking, getters, and `Array<A>` indexing beyond what `own`
covers." It's the last item in the P1 "complete all basic FunctionalScript
operators" task in [`mvp-roadmap.md`](./mvp-roadmap.md).

`own` (`Any::own_property`, in `vm/any/mod.rs`) already does a flat,
prototype-free keyed lookup on `Object<A>` — exactly
`Object.getOwnPropertyDescriptor(o, key)?.value`. The EDAG's actual `.`/`[]`
node is a different, larger contract:

- **Its `index` operand can be a number, not only a string** —
  `Index = number | NumberCast | string` in
  [`fjs/edag/types.ts`](../../fjs/edag/types.ts). Real JS `ToPropertyKey`
  stringifies a numeric key before a plain-object lookup, but `Array`/`String`
  special-case an integer-shaped key — given as either a number or a
  canonical numeric string — as an index. The receiver's type decides which
  rule applies, so key handling can't be centralized ahead of dispatch; it
  has to happen per receiver.
- **It needs `Array<A>` and `String<A>` indexing plus `.length` on both** —
  neither exists yet at the `Any` level. The container types already have
  the raw pieces (`Array<A>`/`String<A>` both implement `Index<u32>` and
  `SizedIndex<u32>` — see `vm/array/index.rs`, `vm/array/sized_index.rs`,
  `vm/string/index.rs`, `vm/string/sized_index.rs`), but both `Index` impls
  currently **panic out of bounds**, which a real operator (answers
  `undefined`, never aborts) can't do — each carries its own `TODO` saying
  so.
- **It is not an `Op2Id`.** `own` is (`op2Id` includes it — see
  `fjs/edag/module.f.mjs`), so it already gets cross-checked test cases for
  free from the shared corpus, [`fjs/nanvm/module.f.mjs`](../../fjs/nanvm/module.f.mjs)
  → `nanvm-lib/tests/test/generated.rs`. `.`/`[]` is its own node kind
  (`['.', exp, index]`, with an optional chain continuation the plain form
  doesn't carry), a shape the generator has no case for today. Getting the
  same JS-engine-cross-checked coverage every other operator has means
  either teaching the generator this node shape or accepting hand-written
  `nanvm-lib` tests for now — a decision this plan defers to Stage 1 rather
  than making silently.

### Non-goals

- **Prototype-chain / built-in methods.** `own_property`'s own doc comment
  is explicit: `nanvm-lib` objects have no `__proto__` to walk at all today.
  Giving `Array`/`String`/`Object` a real prototype chain and a standard
  library (`.map`, `.push`, `.slice`, getters, …) is a separate, open-ended
  effort. This plan closes exactly what the README names — Array indexing,
  `.length`, String indexing — and nothing past it. A key with no matching
  own property keeps reading `undefined`, exactly as `own` does today.
- **Chain steps** (`|.`, `|()`, `|?.()`, `|!()`, and the guarded node forms
  `?.` / `?.()`) carry hidden control flow — a live receiver, an open
  short-circuit region — on top of a plain read, and are their own EDAG node
  kinds ([Chains](../../fjs/edag/README.md#chains)). Stage 3 below produces
  the one primitive (`Any::member_access`) a future chain implementation
  would call; wiring the chain nodes themselves up is separate follow-on
  work, not part of this plan.

### Proposal — three PRs

#### Stage 1 — Array indexing + `.length` (done)

- `Array<A>`'s `Index<u32>` (`vm/array/index.rs`) is left panicking out of
  bounds, unchanged — that's ordinary Rust `Index` convention (`Vec`/slice
  do the same), not a defect. Its own `TODO` floated changing it, but that
  turned out to be unnecessary: `Array::member_access` checks `index < len`
  itself before ever indexing, so the panicking path is never reached from
  here.
- `Array::member_access(&self, key: Any<A>) -> Option<Any<A>>`, in a new
  `vm/array/member_access.rs`, `pub(crate)` — mirroring the exact split
  `Object::own_property` already has from `Any::own_property`: an in-bounds
  integer key (as a `number` or a canonical numeric string) returns the
  element; the string key `"length"` returns `Array::length()` as a
  `Number`; any other key returns `None`, for the caller to turn into
  `undefined`.
- `Any::member_access(self, key: Self) -> Result<Self, Self>`, in a new
  `vm/any/member_access.rs` (its own file, following the existing
  one-operator-per-file layout — `conditional.rs` is the precedent for a
  non-`core::ops` method living in its own file rather than in `mod.rs`) —
  a thin dispatcher: a nullish receiver throws the same
  `Cannot convert undefined or null to object` `own_property` throws today
  (reused, not renamed, its private constant); an `Array` receiver
  delegates to `Array::member_access`, mapping `None` to `undefined`; every
  other receiver is an explicit `todo!()` so Stage 2/3 are pure additions.
- Settled the test-corpus question from Problem above: went with (b) —
  hand-written cases (in `Array::member_access`'s own `#[cfg(test)]`
  module, plus a couple of dispatcher-level ones next to `Any::member_access`)
  rather than teaching the shared corpus generator this node shape. Filing
  the corpus extension as a follow-up remains open.

#### Stage 2 — String indexing + `.length`

- Same shape, for `String<A>`: leave `String<A>`'s `Index<u32>`
  (`vm/string/index.rs`) untouched, for the same reason as Stage 1 —
  bounds-check before indexing rather than changing the panic contract.
- Add `String::member_access(&self, key: Any<A>) -> Option<Any<A>>` in a
  new `vm/string/member_access.rs`, the same split Stage 1 used for
  `Array`: an in-bounds integer key returns the single UTF-16 code unit as
  a one-character `String<A>` (matches JS `str[i]`, *not* `.charAt`, which
  is a prototype method and out of scope); `"length"` returns the UTF-16
  length; anything else returns `None`. Wire the new arm into
  `Any::member_access`'s dispatch in `vm/any/member_access.rs`.
- Reuse Stage 1's key-classification helpers (`canonical_index`,
  `string_to_index`, private to `vm/array/member_access.rs`) rather than
  re-deriving them; if `String` needs them too, move them somewhere both
  modules can reach rather than duplicating.

#### Stage 3 — Object generalization: `member_access` becomes *the* operator

- Extend `Any::member_access`'s dispatch to `Object<A>`, generalizing
  `own_property`: a numeric key is stringified before the lookup (plain
  objects don't special-case numeric keys the way `Array`/`String` do —
  `{0:'a'}[0]` and `{0:'a'}['0']` must agree); otherwise the same
  prototype-free, last-duplicate-wins lookup `own_property` already does.
  Whether this lives in `object/own_property.rs` itself or a sibling
  `object/member_access.rs` is this PR's call.
- Every remaining receiver (`Number`, `Boolean`, `BigInt`, a function) has
  no own properties yet, so always answers `undefined` — the same fallback
  `own_property` has today.
- `nanvm-lib/README.md`'s `.` / `[]` row flips to `[x]`. Whether
  `own_property` stays a separate method or becomes a thin wrapper around
  `member_access` with a string-only key is this PR's call, not this plan's.

### Related

- [`nanvm-lib/README.md`](../README.md) — the live operator status table
  (the `.` / `[]` row this closes).
- [`mvp-roadmap.md`](./mvp-roadmap.md) — "Complete all basic FunctionalScript
  operators," the P1 task this finishes.
- [`fjs/edag/README.md`](../../fjs/edag/README.md) — node shapes, `Index`,
  and the `Chains` section (why chain steps are out of scope here).
- [`nanvm-lib/tests/README.md`](../tests/README.md) — the shared
  operator-corpus mechanism, and the open question of extending it to
  non-`Op*` node shapes.

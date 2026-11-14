## Retire the hand-written `to_json` once FJS JSON serialization compiles to Rust

**Priority:** P3
**Status:** open

### Problem

[`Any::to_json`](../src/vm/any/to_json.rs) (added by #2071) is a hand-written
Rust `Any<A>` -> JSON serializer: numbers, strings, booleans, `null`, and
arrays/objects recursed into, everything else a documented `JsonError`. It
exists purely to prove the walking-skeleton pipeline
([fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md)) end-to-end
while no compiled Rust JSON serializer exists yet.

This repository's strategy is FJS-first: business logic is written in
FunctionalScript and compiled, not hand-written in Rust, wherever the
compiler can reach it (see [`AGENTS.md`](../../../AGENTS.md) §3). A JSON
serializer is exactly this kind of logic — pure, no OS dependency — and
this repository already has one, in FJS:
[`fjs/media/json/serializer/module.f.js`](../../../fjs/media/json/serializer/module.f.js)
(`stringSerialize`/`treeSerialize`, with full proof coverage). `to_json`
duplicates its escaping rules (short escapes, `\uXXXX` for control
characters and lone surrogates, `Number::toString`'s notation rule) by
hand in Rust. The Rust code generator (P1 in [mvp-roadmap](./mvp-roadmap.md))
exists now and reaches literals, arrays, objects, `const` sharing, and
string-keyed property access. The FunctionalScript frontend now accepts the
serializer and its dependency closure, including its recursion; the `.f.js`
extension records that check. Its finite-number leaf uses the admitted
`String` builtin, with explicit `-0` and non-finite `null` handling, rather
than native `JSON.stringify`.

Frontend acceptance does not establish that the Rust backend can emit and run
the entire closure against `nanvm-lib`, or that the compiled artifact meets
the `Any<A>` API's contract. That backend milestone remains open, so
`to_json` stays hand-written until the replacement is demonstrated.

### Proposal

Once `fjs compile <module> <output>.rs` (the Rust code generator, P1 in
[mvp-roadmap](./mvp-roadmap.md)) can compile
`fjs/media/json/serializer/module.f.js` (or an `Any<A>`-aware FJS
serializer built on the same escaping rules) into Rust that calls the
`nanvm-lib` API, retire the hand-written `to_json` in favor of the
compiled version. This is a concrete, checkable milestone for "we compile
what we can" rather than an open-ended aspiration: it doesn't block on the
full compiler, only on JSON serialization's own dependency closure being
supported by the Rust backend and the resulting artifact being verified.

Until then, `to_json` stays as the walking skeleton's stand-in pending a
verified FJS-compiled Rust replacement. `nanvm-harness`'s own
fixtures were an analogous stand-in until #2073's Rust code generator
shipped; they're now `fjs compile` output like any other, wired up in
[fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md).

### Related

- [fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md) — the
  walking-skeleton integration this serializer is part of.
- [mvp-roadmap](./mvp-roadmap.md) — the Rust code generator task that
  unblocks this.
- [`fjs/media/json/serializer/module.f.js`](../../../fjs/media/json/serializer/module.f.js)
  — the FJS serializer to compile toward.
- functionalscript/functionalscript#2071 — where `to_json` was added, and
  where this followup was raised in review.

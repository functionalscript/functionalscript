## Retire the hand-written `to_json` once FJS JSON serialization compiles to Rust

**Priority:** P3
**Status:** open

### Problem

[`Any::to_json`](../src/vm/any/to_json.rs) (added by #2071) is a hand-written
Rust `Any<A>` -> JSON serializer: numbers, strings, booleans, and `null`
only, everything else a documented `JsonError`. It exists purely to prove
the walking-skeleton pipeline
([fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md)) end-to-end
before the Rust code generator exists.

This repository's strategy is FJS-first: business logic is written in
FunctionalScript and compiled, not hand-written in Rust, wherever the
compiler can reach it (see [`AGENTS.md`](../../AGENTS.md) §3). A JSON
serializer is exactly this kind of logic — pure, no OS dependency — and
this repository already has one, in FJS:
[`fjs/media/json/serializer/module.f.mjs`](../../fjs/media/json/serializer/module.f.mjs)
(`stringSerialize`/`treeSerialize`, with full proof coverage). `to_json`
duplicates its escaping rules (short escapes, `\uXXXX` for control
characters and lone surrogates, `Number::toString`'s notation rule) by
hand in Rust, by necessity, because nothing yet compiles FJS to Rust.

### Proposal

Once `fjs compile <module> <output>.rs` (the Rust code generator, P1 in
[mvp-roadmap](./mvp-roadmap.md)) can compile
`fjs/media/json/serializer/module.f.mjs` (or an `Any<A>`-aware FJS
serializer built on the same escaping rules) into Rust that calls the
`nanvm-lib` API, retire the hand-written `to_json` in favor of the
compiled version. This is a concrete, checkable milestone for "we compile
what we can" rather than an open-ended aspiration: it doesn't block on the
full compiler, only on JSON serialization's own dependency closure being
compiler-supported.

Until then, `to_json` stays as the walking skeleton's one remaining
hand-written stand-in — the same role `nanvm-harness`'s own fixtures used
to play, before #2083 wired them to real `fjs compile` output. `to_json`
is hand-written only because JSON serialization's own dependency closure
isn't compiler-supported yet, not because it's the intended long-term
design.

### Related

- [fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md) — the
  walking-skeleton integration this serializer is part of.
- [mvp-roadmap](./mvp-roadmap.md) — the Rust code generator task that
  unblocks this.
- [`fjs/media/json/serializer/module.f.mjs`](../../fjs/media/json/serializer/module.f.mjs)
  — the FJS serializer to compile toward.
- functionalscript/functionalscript#2071 — where `to_json` was added, and
  where this followup was raised in review.

## bigint-literal-beyond-i64. A `bigint` literal past `i64` has no Rust spelling

**Priority:** P2
**Status:** wip

### Problem

The compiler accepts a `bigint` literal of any size, and `BigInt<A>` holds
one of any size, but `fjs compile <module> <output>.rs` refuses every literal
outside `i64`:

```sh
$ echo 'export default 123456789012345678901234567890n;' > big.f.js
$ fjs compile big.f.js big.rs
big.rs - error: no Rust spelling for this module: no Rust i64 for: 123456789012345678901234567890
```

Hexadecimal literals reach it too, `0xFFFFFFFFFFFFFFFFFn`. The only
constructor the generated code has is `vm::unstable::bigint_any(i64)`, and
`bigintExpr` in [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) refuses
what it cannot take. It is a refusal, not a wrong value
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)), but
a valid program fails to compile for the VM, and the spec records the limit
([output](../../spec/README.md#output)) as a gap rather than a decision.

### Proposal

Spell any bigint, so the spec's table says "written" for every graph output.
A literal within `i64` keeps `bigint_any(…)`; a larger one is built from its
magnitude, so the generated text does not depend on parsing decimal digits at
run time:

- a `vm::unstable` helper taking the sign and the magnitude as `u64` words,
  least significant first, such as `bigint_any_words(negative, &[…])`;
- it builds through the existing `BigInt` constructors, which normalize, and
  refuses nothing.

The corpus ([`fjs/nanvm`](../../fjs/nanvm/module.f.mjs)) gains cases past
`i64`, and a harness fixture compiles one end to end and checks it against a
JavaScript engine.

### Tasks

- [ ] A `vm::unstable` helper building a `BigInt` from sign and `u64` words,
      with Rust tests for the `i64` boundaries, a word boundary and a value
      of several words.
- [ ] `bigintExpr` spells a bigint past `i64` through it; the refusal goes.
- [ ] A harness fixture and corpus cases past `i64`, hexadecimal included.
- [ ] Update the spec's output table and
      [`stack-safety.md`](../../fjs/edag/todo/stack-safety.md), which relies
      on the refusal.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%, `npm run gen`, `cargo test`,
      `cargo clippy`, `cargo fmt -- --check`.

### Related

- [mvp-roadmap](./mvp-roadmap.md) — the gap analysis this comes from.
- [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) — `bigintExpr`.

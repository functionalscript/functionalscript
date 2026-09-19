## Stage A binary operators, and `~`, have no `.rs` spelling yet

**Priority:** P2
**Status:** open

### Problem

Stage A of [operators](../../../../spec/todo/2340-operators.md) made the
eighteen binary operators and `~` reachable from source. `fjs/edag/rust`
already has a `nanvm-lib` spelling for most of them — it is shared with
the operator-conformance corpus generator, which needed them first — but
not all: `!==` has no `op2Rust` entry at all, and `===`'s entry calls
`strict_eq`, a helper the operator-test harness defines
(`nanvm-lib/tests/test/harness.rs`), not one `nanvm-lib` itself has. Every
spelling that does exist answers `Result<Any<A>, Any<A>>`, and
`pub fn module<A: IVm>() -> Any<A>` has nowhere to put the `Err`. Before
this refuses cleanly (see below), compiling one of these operators to
`.rs` exited `0` and wrote Rust `rustc` rejects — a type mismatch for
most of them, and a call to `strict_eq`, a test-harness-only helper with
no `nanvm-lib` definition, for `===`.

`resultOperator` in `./module.f.mjs` now refuses every operator node
`op1Rust`/`op2Rust` has an entry for — the same refusal unary `-` on
anything but a numeric literal already got, `bodyLines`'s own comment
has why — so `fjs compile a.f.js b.rs` now fails cleanly instead of
writing code that fails to build. This issue is what would let it
succeed instead.

### Proposal

`nanvm-lib`'s own operators throw because the language's do — division by
a BigInt zero, a numeric overflow the target type cannot hold, `ToPrimitive`
recursing into an object whose `Symbol.toPrimitive` this VM does not run.
A generated module has no caller to hand a `Result` to today, so the
question this issue actually owns is what `pub fn module` should do when
an operator throws: return `Result<Any<A>, Any<A>>` itself (a signature
change every caller of a generated module would need), or `.unwrap()`/
`panic!` (which turns an ordinary language failure into a Rust panic,
which [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
is unlikely to accept as silence-free). Settle that question before
writing the spelling `resultOperator`'s refusal stands in for; changing
`bodyLines`'s own return type without an answer would just move the
mismatch from `rustc` to this module's own type.

### Tasks

- [ ] Decide the generated module's own failure contract (see Proposal).
- [ ] Spell every `op1Rust`/`op2Rust` entry `resultOperator` currently
      refuses, against that contract, in `fjs/fsc/rust/module.f.mjs` — and
      give `!==`/`===` a real `nanvm-lib` spelling first, since neither
      has one to reuse yet (see Problem).
- [ ] New proof coverage per operator, alongside the refusal proofs
      already in `../proof.f.mjs`'s `rustOutput.operators`.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check` on the
      generated output; `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `resultOperator`/`bodyLines`,
  where the refusal this closes lives.
- [`../../../edag/rust/module.f.mjs`](../../../edag/rust/module.f.mjs) —
  `op1Rust`/`op2Rust`, the spellings this issue's fix reuses, and the
  operator-conformance corpus generator that already exercises them
  through `strict_eq`/`check` rather than a bare `Any<A>` return.
- [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md) —
  Stage A itself.
- [`../../serializer/todo/stage-a-operators.md`](../../serializer/todo/stage-a-operators.md) —
  the same gap in the `.js`/`.mjs` output, filed alongside this one.

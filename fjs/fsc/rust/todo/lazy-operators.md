## The lazy operators have no lazy `.rs` spelling

**Priority:** P2
**Status:** blocked
**Blocked by:** [the generated module's failure contract](./stage-a-operators.md),
which every operator in a module waits on, and
[Stage B](../../todo/stage-b-operators.md) making these nodes reachable
from source

### Problem

`nanvm-lib` has the four operations — `Any::logical_and`, `logical_or`,
`nullish_coalescing` and `conditional`, in `nanvm-lib/src/vm/any/` — and
`fjs/edag/rust`'s `op2Rust`/`op3Rust` spell them, so the operator corpus
checks each against a JavaScript engine. Every one takes its operands as
`Self`, by value: right for the corpus, whose operands are values before
the case is stated, and wrong for a compiled module, where `a && b`
establishes `b` only when `a` is truthy and `c ? t : e` establishes one
arm — Rust would evaluate both before the call, and `false && (1n / 0n)`
would throw where JavaScript answers `false`. The EDAG says which
operands are lazy ([`fjs/edag/module.f.mjs`](../../../edag/module.f.mjs),
`op2Id` and `op3Id`); the printed Rust has nowhere to say it.

Nothing tracked this: the roadmap's operator item is done, the operations
being what it asked for, and `?:` is its own item there, about the VM.
Until this issue closes, `fjs/fsc/rust`'s `resultOperator` refuses these
nodes in a module, as it refuses every operator in one today, and Stage B
extends that refusal to the length-4 `?:` node. The Stage A task, which
spells the eager operators against the failure contract, leaves these
four refused by its own terms: their entries sit in the same `op2Rust`
table, and spelling them there would be exactly the eager miscompile
above.

### Proposal

A spelling whose lazy operands are not evaluated before the call — a
closure per lazy operand, or an operation on the VM that takes one — and
the shared printer telling the two callers apart, since the corpus keeps
the by-value form. Which of those, and whether `nanvm-lib` grows an
operation for it, is decided with the failure contract this is blocked on:
both change what a printed operator returns, and one answer should serve
both.

### Tasks

- [ ] Decide the lazy spelling with the failure contract.
- [ ] Spell `&&`, `||`, `??` and `?:` that way in `fjs/fsc/rust`, and lift
      `resultOperator`'s refusal for them; prove `false && (1n / 0n)` and
      a `?:` with a throwing unselected arm through `nanvm-harness`.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`; `tsc`,
      `fjs test`, `npm run cov` at 100%.

### Related

- [Stage A operators](./stage-a-operators.md) — the failure contract, and
  the same refusal for the eager operators.
- [Stage B operators](../../todo/stage-b-operators.md) — the front end that
  makes these nodes reachable.
- [`fjs/edag/rust/module.f.mjs`](../../../edag/rust/module.f.mjs) — the
  by-value spellings the corpus keeps.

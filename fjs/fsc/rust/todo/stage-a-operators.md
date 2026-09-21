## Stage A binary operators, and `~`, have no `.rs` spelling yet

**Priority:** P2
**Status:** open

### Problem

Stage A of [operators](../../../../spec/todo/2340-operators.md) made the
eighteen binary operators and `~` reachable from source. `fjs/edag/rust`
has a `nanvm-lib` spelling for every one of them — it is shared with the
operator-conformance corpus generator, which needed them first; `===` and
`!==` call `strict_eq` and `strict_ne` in `nanvm_lib::vm::unstable`. Every
spelling answers `Result<Any<A>, Any<A>>`, and so does
`pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>` now — but the printer
does not yet append the `?` that would hand an operator's `Err` to it, and
a `let` binding and the body's `Ok(…)` each want a bare `Any<A>`. Before
this refuses cleanly (see below), compiling one of these operators to
`.rs` exited `0` and wrote Rust `rustc` rejects with a type mismatch.

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
The failure contract is decided: `pub fn module` answers
`Result<Any<A>, Any<A>>`, the `Err` the thrown value, the same shape every
operator has, so a language failure stays a value the caller receives and
never becomes a Rust panic
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle));
a `.` read already propagates with `?`, and the harness reports a throw as
the value it is. What remains is the spelling: an operator's text followed
by `?`, in the body and in a `let` binding alike.

### Tasks

- [x] Decide the generated module's own failure contract (see Proposal).
- [ ] Spell Stage A's own operators — the eighteen binary ones and `~`,
      every one eager — against that contract, in
      `fjs/fsc/rust/module.f.mjs`. `op2Rust` also holds `&&`, `||` and `??`, and `op3Rust` holds `?:`:
      those four stay refused here, whatever this task does, since their
      by-value spelling evaluates an operand JavaScript would not — they
      are [`lazy-operators.md`](./lazy-operators.md)'s, after this one.
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
  through `check` rather than a bare `Any<A>` return.
- [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md) —
  Stage A itself.
- [`../../serializer/todo/stage-a-operators.md`](../../serializer/todo/stage-a-operators.md) —
  the same gap in the `.js`/`.mjs` output, filed alongside this one.
- [`lazy-operators.md`](./lazy-operators.md) — `&&`, `||`, `??` and `?:`,
  which this task leaves refused.

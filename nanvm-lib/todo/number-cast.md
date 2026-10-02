## number-cast. The EDAG's `Number` cast has no VM operation

**Priority:** P2
**Status:** wip

### Problem

The EDAG has a unary `['Number', exp]` node, JavaScript's `Number(x)`: the
coercion form, which differs from unary `+` in one case, a bigint. `+1n`
throws, and `Number(1n)` is `1`. The JavaScript evaluators implement it
([`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs)); `nanvm-lib`
does not, so the Rust printer refuses the node (`no Rust for: Number`) and the
operation has no corpus case.

```sh
$ node -e "..."   # scope(['Number', '1'])
error ["no Rust for","Number"]
```

No source spelling reaches the node yet (the parser takes no `Number(…)`), so
nothing a user writes fails today. The gap is the VM's: it is the one unary
EDAG operation without an `Any` method. Its other use, the computed index
`a[Number(k)]` ([property-accessor](../../spec/todo/2330-property-accessor.md)),
needs the operation first.

### Proposal

`Any::number(self) -> Result<Any<A>, Any<A>>`, `Number(value)` of ECMAScript:
`ToNumeric` of the value, and a bigint result converted to a number by
rounding to the nearest `f64`, as `Number(bigint)` does. Anything else is
`ToNumber`'s, which is `unary_plus`. A bigint past `f64`'s range is
`Infinity`/`-Infinity`.

The printer spells the node as `Any::number(a)`, and the corpus gains a group
beside `unary +`: every `ToNumeric` operand, and the bigint rows that tell the
two apart.

### Tasks

- [ ] `BigInt` to `f64`, rounding to nearest even, with `Infinity` past the
      range; Rust tests at the `2^53` boundary, a tie, and a value of several
      words.
- [ ] `Any::number`, with Rust tests.
- [ ] `op1Rust` spells `Number`; corpus group `numberCast`, run on the host
      engine and as generated Rust.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%, `npm run gen`, `cargo test`,
      `cargo clippy`, `cargo fmt -- --check`.

### Related

- [is-operator](../../fjs/edag/todo/is-operator.md) — the other EDAG
  operation `nanvm-lib` lacks.
- [mvp-roadmap](./mvp-roadmap.md) — the gap analysis this comes from.

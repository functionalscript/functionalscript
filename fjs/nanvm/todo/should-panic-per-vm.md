## A should-panic set: the corpus generated once per VM

**Priority:** P4
**Status:** on-hold

### Problem

The corpus proves that `&&`/`||`/`??`/`?:` leave their unselected operand
unestablished through the value: an `unreached` operand lowers to `1n /
0n`, so `false && unreached` answers `false` on `nanvm-lib` only because
`Any::logical_and` never called the thunk — and if it had, `check` would
have reported the throw. That is the proof [`../README.md`](../README.md)
describes, and it is enough for the operations as they stand.

It proves non-establishment through what a wrongly established operand
*returns*. A second, harder proof would go through what the thunk *does*:
a thunk that panics when called — `|| not_established()`, a
`vm::unstable` helper, since generated code spells no macro, `panic!`
included — inside a test that must fail if the thunk runs, and a
companion set that must fail, `#[should_panic]`, stating that the harness
would catch an establishment rather than assuming it. The value proof
cannot be fooled by an operation that swallows the `Err` on its way back,
say a future operator that catches; the panic proof cannot.

The corpus cannot generate that set today. A `#[should_panic]` test is a
concrete `#[test]` function, and [`rust/module.f.mjs`](../rust/module.f.mjs)
prints every group as one function generic over `IVm`, `fn
logical_and<A: IVm>()`, called once per VM from the hand-written `test`
in `nanvm-lib/tests/test/main.rs` — a shape that has no place for a
per-case attribute. Generating the set means generating the corpus once
per VM instead of once over `IVm`: a `#[test]` per case per VM, or a
module per VM instantiating a generic body, with the should-panic cases
carrying their attribute on the concrete function.

### Proposal

Nothing yet beyond the shape above. It waits on there being a second VM
to generate for, which is what would make the per-VM shape earn its
cost; until then the value proof stands alone, and a redesign of the
generated file's shape for one VM is not worth the diff to
`gen.corpus/`.

### Tasks

- [ ] `vm::unstable`: a `not_established()` helper that panics, for a
      thunk generated code can spell.
- [ ] `fjs/nanvm/rust`: generate the corpus once per VM, so a case can be
      a concrete `#[test]` with an attribute.
- [ ] The should-panic set: for each lazy group, a case whose *selected*
      operand is the panicking thunk, `#[should_panic]`, proving the
      harness sees an establishment.
- [ ] `npm run gen` with no drift; `cargo test`, `cargo clippy
      --all-targets`, `cargo fmt -- --check`.

### Related

- [`../README.md`](../README.md) — the `unreached` operand, the value
  proof this would second.
- [`corpus-as-conformance-vectors.md`](./corpus-as-conformance-vectors.md)
  — the corpus's other open question, its transport to the `nanvm-lib`
  interpreter.
- `nanvm-lib/src/vm/any/{and,or,nullish_coalescing,conditional}.rs` — the
  four signatures, each lazy operand an `impl FnOnce() -> Result<Any<A>,
  Any<A>>`.

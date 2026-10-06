## Implement the native effect runner

**Priority:** P2
**Status:** open

### Problem

AOT-compiled FJS returns effects as VM values. It needs a native runner, not
another representation of those values or a schema-to-Rust type system.

### Proposal

Keep `nanvm-effects-node` separate from the pure `nanvm-lib`. Use
[`nanvm_lib::vm`](../nanvm-lib/src/vm/mod.rs) directly: `Any<A>` with `A: IVm`,
and its existing `Function<A>`, `Array<A>`, `Object<A>`, `String<A>` and
`BigInt<A>` wrappers where needed. Requests, results, continuations and
returned or thrown values stay VM values, preserving their identity.

Use the existing [`Effect`](../fjs/effects/types.ts) representation:

- `Pure` is a function with no arguments that returns an FJS `Result`.
- `Do` is an object with `command`, `payload` and `continuation` properties.

Do not introduce native copies of effect data types, an RTTI-to-Rust printer,
a generated operations trait, a codec, or serialization between the program
and runner. Existing effect schemas may remain for their existing consumers;
they are not a prerequisite for this runner. This replaces the generated-stub
direction proposed in [PR #2573](https://github.com/functionalscript/functionalscript/pull/2573).

### Synchronous cycle

One ordinary loop is sufficient. `perform` below is an opaque synchronous
operation boundary; its implementation is not part of this design.

```rust
use nanvm_lib::vm::{Any, IVm, ToAny, ToArray};

fn run<A: IVm>(
    mut effect: Any<A>,
    mut perform: impl FnMut(Any<A>, Any<A>) -> Result<Any<A>, Any<A>>,
) -> Result<Any<A>, Any<A>> {
    loop {
        if effect.clone().typeof_()? == "function".into() {
            return effect.call([].to_array().to_any());
        }
        let command = effect.clone().dot("command".into()).end()?;
        let payload = effect.clone().dot("payload".into()).end()?;
        let continuation = effect.dot("continuation".into()).end()?;
        let answer = perform(command, payload)?;
        effect = continuation.call([answer].to_array().to_any())?;
    }
}
```

The FJS `Result` (`['ok', value]` or `['error', error]`) is an ordinary VM
array. Pass the complete operation result to the continuation, including an
`error`; do not unwrap it or terminate the loop on it. A `Pure` returns its
complete result unchanged. The outer Rust `Result<Any<A>, Any<A>>` is different:
`Err` propagates a language throw from a VM call, not an FJS error result.

There is no async runtime, scheduler, task queue or recursive stepping of the
effect chain. Parser, compiler, loader and other language logic stay in FJS.
No Rust EDAG representation or executor is required.

### Required VM operators and functions

The VM must supply the following operations. They already have public
implementations in `nanvm-lib`; reuse them rather than adding runner-specific
versions or treating them as unfinished work.

| Operation | Existing VM API | Used for |
| --- | --- | --- |
| `typeof` | [`Any::typeof_`](../nanvm-lib/src/vm/any/typeof_.rs) | Distinguish a `Pure` function from a `Do` object. |
| `===` | [`Any`'s `PartialEq`](../nanvm-lib/src/vm/any/partial_eq.rs) | Compare the type tag with `"function"`. |
| Property access, `.` / `[]` | [`Any::dot(...).end()`](../nanvm-lib/src/vm/any/dot.rs) | Read `command`, `payload` and `continuation`. |
| Function call, `()` | [`Any::call`](../nanvm-lib/src/vm/any/call.rs) | Call a `Pure` with no arguments or a continuation with one complete result; preserve returned and thrown values. |
| VM value construction and sharing | `Any::from`, `Any::clone`, `ToArray::to_array`, `ToAny::to_any` | Construct property-name strings and argument arrays without translating or copying their contained VM values. |

Rust supplies the loop and branch; they need no new VM instruction. Operators
and built-ins used by a particular compiled FJS program are that program's
separate compiler/VM requirements, not prerequisites added by this loop.

### Scope

This TODO specifies the runner's value model and control flow only. It contains
no design for implementing individual Node effects. Those implementations are
separate work, driven by actual consumers.

### Tasks

- [ ] Add the runner crate using `nanvm-lib` values directly.
- [ ] Implement the synchronous loop above without a second effect/value model.
- [ ] Prove `Pure` success and error results, sequential continuation calls,
      recovery from an operation error, propagation of language throws, and
      preservation of callable/value identity using a small test boundary.
- [ ] Prove a long effect sequence does not grow the runner's call stack.
- [ ] Run an AOT-compiled FJS effect fixture through the same loop.

### Related

- [MVP roadmap](../nanvm-lib/todo/mvp-roadmap.md#effects-the-nanvm-effects-node-runner-crate-decided).
- [Effect representation and matching](../fjs/effects/module.f.mjs).
- [Existing JavaScript runner](../fjs/effects/module.mjs) — the same stepping
  structure; the native loop is synchronous.
- [FJS module loader](../fjs/compiler/todo/load-modules-without-import-effect.md).
- [FJS proof loading](../fjs/emergent_testing/todo/load-proofs-through-fjs.md).
- [console-program](../nanvm-lib/todo/console-program.md) — native packaging.

## A complex node has no mapping to a `nanvm-lib` operation

**Priority:** P2
**Status:** open

### Problem

The printer in [`module.f.mjs`](../module.f.mjs) maps an EDAG node to a
`nanvm-lib` operation one to one where the node is a value over values:
an operator node to the `Any` operator it names, `['()', callee, args]`
to `Any::call`, a plain `['.', receiver, key]` to `Any::member_access`.
Each operation answers the node's value, or the thrown value, as a
`Result<Any<A>, Any<A>>`, and the generated text is right by construction:
a spelling that does not follow the operation's signature does not compile.

The complex nodes have no such mapping. A `.` node with a continuation —
`['.', a, 'b', ['|()', args]]`, the method call `a.b(...args)` — and the
chain steps `|.`, `|?.()`, `|!()` and the `?.` region carry control flow
their operand values do not: a receiver handed to the call as `this`, and
a short-circuit region skipping the rest of the chain
([`../../README.md`](../../README.md), Chains). No composition of the value
operations preserves that. `Any::member_access(a, b)` answers the
property's value and nothing else, so the receiver is gone the moment the
read answers, and `member_access(a, b).and_then(|f| Any::call(f, args))`
spells the detached call `(0, a.b)(...args)`, not the method call the node
means. That the two agree today — a FunctionalScript function is an arrow
function with no `this`, and `nanvm-lib` has no built-in method that reads
a receiver — makes the text plausible, not right: the moment either exists,
every module generated that way is wrong, and the fix is a generator
change and a regeneration where it should be a change in `nanvm-lib`
alone. #2173 tried that spelling and was closed for it.

So the printer refuses every continuation today, which is the honest
state, and the rule for the eager operators and the lazy ones holds for
these too: the operation comes first, in `nanvm-lib`, with the signature
the node's semantics need, and the printer prints it. What is missing is
the design of that mapping — which operations the complex nodes are, what
each takes, how a chain's two bits of state cross an operation boundary —
and it is not designed here. This file records the problem so that no
spelling composed from value operations is tried again in its place.

### Related

- [`../module.f.mjs`](../module.f.mjs) — the printer, and the `.` case that
  refuses a continuation.
- [`../../README.md`](../../README.md) — Chains: the continuation operand,
  the two bits of state, the four steps.
- [`../../../../nanvm-lib/todo/callable-function-objects.md`](../../../../nanvm-lib/todo/callable-function-objects.md)
  — Stage 4, open for the method call this problem is about.
- `nanvm-lib/src/vm/any/member_access.rs`, `nanvm-lib/src/vm/any/call.rs` —
  the two value operations that do not compose into a method call.

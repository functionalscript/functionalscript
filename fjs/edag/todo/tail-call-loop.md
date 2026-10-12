## Write a tail self-call as a loop

**Priority:** P2
**Status:** wip

### Problem

Both serializers spell a function that calls itself as recursion. The
code-only JavaScript text
([`fjs/compiler/serializer/function_text`](../../compiler/serializer/function_text/module.f.mjs))
spells it as a named function expression, and the Rust output
([`fjs/edag/rust`](../rust/module.f.mjs)) as `Any::call` of `self_`. V8 —
Node, Chromium, Deno, Bun on it — implements no tail calls, and neither does
Rust, so a function that iterates by calling itself last overflows the stack
after some thousands of rounds in either output.

The shape is what a loop lowers to
([stage 1 discussion §11](../../../todo/edag-stage1-discussion.md#11-let-loops-and-tail-calls)),
so the serializers must spell it as a loop before any lowering can land. It
is a property of the graph, not a mark the compiler leaves, so a hand-written
tail-recursive function gets the same loop.

### Proposal

**Recognize** the shape in the analysis table
([`fjs/edag/analysis`](../analysis/module.f.mjs)) with one exported
predicate both serializers import — `tailCalls` in a new `fjs/edag/loop`
module: the entries of a function's tail self-calls, or `null` where the
function is not a loop.

A position is *tail* when it is the body root, an arm of a `?:` in tail
position, or the last operand of a `,` in tail position; nothing else is. A
*tail self-call* is a `['()', ['self'], args]` in tail position whose `args`
do not reach `self`. A function is a *loop* when it reads its `self` at all,
and every read is the callee of a tail self-call reached by one edge and
through unshared nodes only — a shared `?:` or `,` on the path is written
once, as an expression, where no statement can stand. Every condition and
every assert on the path must not reach `self` either, which also keeps
`self` from escaping as a value: into an argument, an array, or a nested
function's frame. Anything else is not a loop and stays the recursion it is
today, the author's own.

Whether an entry reaches `self` is one pass over the table, an entry coming
after its operands; the walk then follows tail positions from the root,
collecting the self-calls and refusing on the first read of `self` anywhere
else. The right operand of `&&`, `||` and `??` is left non-tail for now:
treating it as tail would need a statement spelling for each.

**Write** a loop-shaped function in statement form, the parameters its loop
variables:

```js
($0)=>{for(;;){if((($0)<(10))){[$0]=[(($0)+(1))];continue;}return ($0);}}
```

A `?:` on the tail path is an `if` whose consequent ends in `continue` or
`return`, so the alternative follows it as the fall-through; a `,` is its
asserts as expression statements and then its last operand; a tail
self-call is a parallel assignment of the parameters, `[$0,...$1]=[…]`, and
`continue` — the array on the right is built before any parameter changes,
as a call's arguments are evaluated before the call; any other tail operand
is `return`ed. Everything off the tail path is the expression the writer
emits today. The invocation-local memo cells are declared inside the `for`,
so each round starts fresh as each call did. The function needs no name: no
`self` read survives the rewrite, so it is an arrow again.

The Rust output spells the same verdict in its own form: the closure's body
becomes `loop { … }`; a `?:` on the tail path is
`if c.to_boolean() { … } else { … }` instead of `Any::conditional` over
thunks, so the arms are blocks that can `continue`; a tail self-call rebinds
`args` and `continue`s; the temporaries a round binds are declared inside the
loop.

### Tasks

- [ ] `fjs/edag/loop`: `tailCalls` and `tailOperands`, with the refusals
      proven: a non-tail self-call, `self` escaping into a nested function's
      frame, a shared node on the tail path, a self-reaching condition,
      assert or argument.
- [ ] `fjs/compiler/serializer/function_text`: the statement form for a
      loop-shaped function; a host proof runs a million rounds, which the
      named function expression could not.
- [ ] `fjs/edag/rust`: the `loop` form, and a `cargo test` over a generated
      module running a million rounds.

### Related

- [stage 1 discussion §11](../../../todo/edag-stage1-discussion.md#11-let-loops-and-tail-calls)
  — why a loop is a tail call and not a node.
- [`function-text.md`](../function-text.md) — the text contract the
  JavaScript form lives under.
- [stack-safety](./stack-safety.md) — the writers' own recursion, a separate
  concern from the program's.

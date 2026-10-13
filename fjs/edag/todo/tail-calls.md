## Make a call in tail position the executor's loop

**Priority:** P2
**Status:** wip

### Problem

Both executors, [memo](../memo/module.f.mjs) and
[amnesia](../amnesia/module.f.mjs), make every call by host recursion: the
`()` operation of the shared [operations](../operations/module.f.mjs)
dispatcher hands the bound arguments to the executor's `invoke`, which
evaluates the body inside the caller's own host frames, and the body's value
returns back up through them. A call in tail position — one whose value is
the body's value — grows the host stack as any other, so a function that
iterates by calling itself last overflows after a few hundred rounds: at
`8d86959`, the loop template of
[tail-call-loop](./tail-call-loop.md), `r => r < N ? self(r + 1) : r`,
answers at six hundred rounds and fails with V8's `RangeError` at eight
hundred, in both executors, on x64 Node 26 with the default stack.

The writers already spell that template as a loop, so the `.js` and `.rs`
outputs run it in constant stack where the interpreters, which `fjs` runs a
module's initializer through, do not. Every loop a FunctionalScript program
writes is a self-call ([stage 1 discussion §11](../../../todo/edag-stage1-discussion.md#11-let-loops-and-tail-calls)),
so every loop is affected.

### Proposal

Proper tail calls in the dispatcher, made by the executor. A call in tail
position of an invocation — the body root, either arm of a `?:` there, the
last operand of a `,` there, the right operand of `&&`, `||` or `??` there,
and so on through those positions; the call a bare `()` or `?.()` makes, or
the last call step of a chain, where the callee is a represented function —
is answered by the dispatcher as the call prepared and not yet made: the
function with its fixed and rest bindings, [`value/call`](../value/call/module.f.mjs)'s
`prepare`. The executor makes it in the invocation's place, in a loop, so a
chain of tail calls however long holds one host frame set: `invoker` in
`value/call` turns a body evaluator into an `Invoke`. Everywhere else a call's
value is needed at once, and `settle` makes it there: a call step a further
step continues, an operand of any other operation, a builtin's callback.

Nothing else changes. Each call the loop makes is a fresh invocation with its
own fixed values, rest array, frame and memo cache, as the recursion's were,
so no shape the writers keep the recursion for is a concern here. A built-in
method is answered as a value, as it was. Memo caches the value a shared node
settles to; a shared node answering a call is left uncached, since the
invocation ends with it.

The dispatcher threads a second operand callback, `tail`, beside `operand`:
the executor looks a tail-position operand up as it looks any up, and runs
the node in tail mode where it has no value for it. Amnesia's state is the
same `null`; memo's cache is unchanged in shape.

### Tasks

- [ ] `value/call`: `prepare`, the binding alone; `settle` and `invoker`
      over the prepared call; `call` as the two composed.
- [ ] `operations`: the tail-position dispatch, a `Tail` evaluation type
      beside `Evaluation`, the `tail` callback in `Evaluator`.
- [ ] `memo` and `amnesia`: evaluate a body and the module root in tail
      mode; `invoke` as the loop.
- [ ] Proofs in both executors: a self-call many times deeper than the host
      stack, mutual recursion through an argument, a tail method call and a
      tail optional call, a tail call under `,`, `&&` and `?:`, and a chain
      whose call step is continued still answered in place.
- [ ] Documentation: [`values.md`](../values.md)'s operations section, the
      executors' README paragraphs on calls, stage 1 discussion §11 and
      [tail-call-loop](./tail-call-loop.md), which name the interpreters.
- [ ] `tsc`, `fjs test`, scoped coverage at 100%.

### Related

- [tail-call-loop](./tail-call-loop.md) — the same recursion in the
  writers' outputs, where one template is spelled as a loop.
- [stack-safety](./stack-safety.md) — the walks' own recursion through a
  deep graph, a separate concern from the program's calls.
- [bound-edag-interpreter-resources](../../compiler/todo/bound-edag-interpreter-resources.md)
  — deterministic budgets; host-stack independence of the walks is that
  issue's, of a program's loops this one's.

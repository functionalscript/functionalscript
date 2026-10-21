## The explicit-stack walkers share one driver loop

**Priority:** P3
**Status:** open

### Problem

Deep input is walked over an explicit stack so that depth is bounded by
memory and not by the host's call stack, and the loop that drives such a walk
is written by hand each time. `evaluate` in
[`fjs/media/datajs/parser`](../../media/datajs/parser/module.f.mjs), `read`
in [`fjs/media/datajs/serializer`](../../media/datajs/serializer/module.f.mjs)
and the inner loop of `build` in [`fjs/ebnf/ll1`](../../ebnf/ll1/module.f.mjs)
each keep a `{ top, rest }` cons-stack of frames, an `['enter', x]` step, a
container frame advanced by `round`, and the same driver:

```js
// datajs/parser evaluate
let state = [null, ['enter', root]]
while (true) {
    const [stack, step] = state
    if (step[0] === 'enter') { state = enter(stack, step[1]) }
    else if (step[0] === 'error' || stack === null) { return step }
    else {
        const { top, rest } = stack
        state = round(rest, { ...top, index: top.index + 1, done: concat(top.done)([step[1]]) })
    }
}
// datajs/serializer read
let state = [null, start, ok(toEnter(value))]
while (true) {
    const [stack, walk, next] = state
    if (next[0] === 'error') { return next }
    const todo = next[1]
    if (todo[0] === 'enter') { state = enterWith(stack, walk, todo[1]) }
    else if (stack === null) { return ok([walk, todo]) }
    else {
        const { top, rest } = stack
        state = round(rest, walk, { ...top, index: top.index + 1, /* … */ })
    }
}
```

[`fjs/compiler/parser`](../../compiler/parser/module.f.mjs) has one of its
own, and [deep-nesting](../../ebnf/data/todo/deep-nesting.md) schedules the
next,
"over an explicit stack … the ll1 machine is the shape to follow" — a pattern
to imitate where a function would do.

### Proposal

A driver in `fjs/types`, say `stack_walk`: `walk({ enter, resume })`, with
`enter(node) => [frame | null, step]` and `resume(frame, result) => [frame |
null, step]`, owning the loop, the cons-stack, the error short-circuit and
the empty-stack exit; a variant threading an accumulator for the serializer's
`walk` and ll1's `pos`. `evaluate` and `read` become their `enter` and `close`
cases. ll1 adopts it now or after
[043-stateful-parser](../../ebnf/todo/043-stateful-parser.md) reshapes it;
deep-nesting then has a driver instead of a pattern. The depth contract —
"5,000 levels of brackets" in [datajs](../../media/datajs/README.md) —
becomes a property of one loop.

### Tasks

- [x] `stack_walk` with its proof, including the depth it carries.
- [x] `datajs/parser` and `datajs/serializer` on it.
- [ ] `ll1`, `compiler/parser` and `ebnf/data`'s `lower`, as each is next
      touched.

### Related

- [deep-nesting](../../ebnf/data/todo/deep-nesting.md) — the next
  hand-written copy, unless this lands first.
- [deep-nesting-recursion](../../compiler/todo/deep-nesting-recursion.md) —
  the compiler's recursion budget.
- [stack-safety](../../edag/todo/stack-safety.md) — the same concern in the
  executors.

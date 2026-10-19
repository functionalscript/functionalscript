## `amnesia` and `memo` write the same invoker around one different line

**Priority:** P4
**Status:** open

### Problem

The two executors share their operations through
[`operations`](../operations/module.f.mjs) ([analysis](./analysis.md) records
that move) and their call protocol through
[`value/call`](../value/call/module.f.mjs)'s `invoker` and `settle`. What was
not moved is the wrapper that ties them, which
[`amnesia`](../amnesia/module.f.mjs) and [`memo`](../memo/module.f.mjs) write
identically:

```js
export const invokeWith = runtime => {
    const run = (fn, fixed, rest, self) => /* the one line that differs */
    const body = (fn, fixed, rest) => fn[0] === 'entry' ? entryCall(fixed, invoke)
        : fn[0] === 'hasEntry' ? hasEntryCall(fixed, invoke)
        : isStatic(fn) ? staticCall(runtime, fn, rest, run)
        : run(fn, fixed, rest, fn)
    const invoke = invoker(body)
    return invoke
}
export const invoke = invokeWith(undefined)
```

`body` is the same text in both: the dispatch over `entryCall`, `hasEntryCall`
and `staticCall` from `operations`, and the `invoker` tie. So is the context
literal both `run`s build, `{ frame: fn[2], args: [], fixed, rest, self,
runtime }`. What differs is `run`'s last line, how a closure's body is run
under that context — `outcome(context)(fn[3])` in `amnesia`,
`evaluate(identityAnalysis(fn), context, root)` in `memo` — and that one
difference is buried in the copy.

### Proposal

`value/call` exports `invokerWith(run)`: given `run(fn, context) => Outcome`,
it builds the context, writes `body`'s dispatch once over `entryCall`,
`hasEntryCall` and `staticCall`, and ties `invoker`, answering the
`runtime => Invoke` both modules export. Each executor states only its
`run`, and `invoke = invokeWith(undefined)` is derived there too.

### Tasks

- [ ] `invokerWith` in `value/call`, with proof.
- [ ] `amnesia` and `memo` reduce to their `run`.

### Related

- [analysis](./analysis.md) — the operations table, the earlier half of the
  same extraction.
- [tail-call-loop](./tail-call-loop.md) — changes what `settle` does; one
  wrapper is one place to change.

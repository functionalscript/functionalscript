## Report each bit's height: the levels that close a word on it

**Priority:** P4
**Status:** wip

### Problem

`encode` (`fjs/sul/module.f.mjs`) knows, on every bit it takes, which levels
close a word on it, but it returns only the next state from `push` and only
the root from `end`. A caller that needs where the words end — the stripes
demo, to draw rows above L3 — has to follow the levels itself: feed L1 to
L3, the hash levels above them, and pad as `end` does. That is a second copy
of the encoder, and it drifts silently when the encoder changes, such as its
padding rule.

### Proposal

`Encode<S>` (`fjs/sul/types.ts`) gains two members beside `push` and `end`,
which keep their signatures and become the same functions with the height
dropped. A bit's **height** is how many levels close a word on it, counting
up from L1: 0 for none, 2 for L1 and L2, 5 for L1 to H2.

```ts
export type Encode<S> = {
    readonly push: (bit: bigint, state: EncodeState<S>) => EncodeState<S>
    readonly end: (state: EncodeState<S>) => Id
    /** `push`, also giving the bit's height. */
    readonly pushWithHeight: (bit: bigint, state: EncodeState<S>) => readonly [height: number, state: EncodeState<S>]
    /**
     * `end`, also giving the height of each padding bit it adds — a `1`,
     * then `0`s, until the root.
     */
    readonly endWithHeights: (state: EncodeState<S>) => readonly [heights: readonly number[], root: Id]
}
```

The padding rule stays inside `endWithHeights`, so no caller repeats it.
`encode` feeds the literal levels one at a time through `levels`
(`level/literal/module.f.mjs`), since `pipelineStep` reports only L3's
output; `pipelineStep` itself is unchanged. No existing caller changes.

Naming: `pushWithHeight` rather than `pushHeight`, which reads as pushing a
height; and new members rather than `push` and `end` returning the height,
so that callers which need only the state or the root are not handed a
number to ignore.

### Related

- [stripes-demo-next.md](./stripes-demo-next.md) — its hash-level rows are
  drawn from these numbers

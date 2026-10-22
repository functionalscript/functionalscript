## Report which levels close a word on each bit

**Priority:** P4
**Status:** open

### Problem

`encode` (`fjs/sul/module.f.mjs`) knows, on every bit it takes, which levels
close a word on it, but it returns only the next state from `push` and only
the root from `end`. A caller that needs where the words end — the stripes
demo, to draw rows above L3 — has to follow the levels itself: feed L1 to
L3, the hash levels above them, and pad as `end` does. That is a second copy
of the encoder, and it drifts silently when the encoder changes, such as its
padding rule.

### Proposal

`Encode<S>` (`fjs/sul/types.ts`) gains two members; `push` and `end` keep
their signatures and become the same functions with the extra answer
dropped:

```ts
export type Encode<S> = {
    readonly push: (bit: bigint, state: EncodeState<S>) => EncodeState<S>
    readonly end: (state: EncodeState<S>) => Id
    /**
     * `push`, also saying how many levels closed a word on this bit,
     * counting up from L1: 0 for none, 2 for L1 and L2, 5 for L1 to H2.
     */
    readonly step: (bit: bigint, state: EncodeState<S>) => readonly [number, EncodeState<S>]
    /**
     * `end`, also giving that number for each padding bit it adds
     * (a `1`, then `0`s, until the root).
     */
    readonly endSteps: (state: EncodeState<S>) => readonly [readonly number[], Id]
}
```

The padding rule stays inside `endSteps`, so no caller repeats it. `encode`
feeds the literal levels one at a time through `levels`
(`level/literal/module.f.mjs`), since `pipelineStep` reports only L3's
output; `pipelineStep` itself is unchanged. No existing caller changes.

### Related

- [stripes-demo-next.md](./stripes-demo-next.md) — its hash-level rows are
  drawn from these numbers

# TODO

## Uncurry accumulator types

**Priority:** P5
**Status:** open

### Problem

`StateScan` was refactored ([#763](https://github.com/functionalscript/functionalscript/pull/763)) from a curried `(value) => (state) => …` form to an uncurried `(input, prior) => …` form. The motivation: both parameters are *data* (a stream element and the threaded state), not operator/config parameters. Currying them only invites partial application that captures a per-element value or an accumulator — meaningless to cache, and a state-leak hazard.

Several sibling accumulator types still curry their data parameters, contradicting that precedent:

```ts
// fs/types/function/operator/module.f.ts
export type Fold<I, O> = Binary<I, O, O>   // (input: I) => (acc: O) => O
export type Reduce<T>  = Fold<T, T>        // (value: T) => (acc: T) => T

// fs/types/sorted_list/module.f.ts
export type ReduceOp<T, S>   = (state: S) => (a: T) => (b: T) => readonly[Nullable<T>, Sign, S]
export type TailReduce<T, S> = (state: S) => (tail: List<T>) => List<T>
```

### Proposal

Uncurry the data parameters:

```ts
export type Fold<I, O> = (input: I, acc: O) => O
export type Reduce<T>  = Fold<T, T>

export type ReduceOp<T, S>   = (state: S, a: T, b: T) => readonly[Nullable<T>, Sign, S]
export type TailReduce<T, S> = (state: S, tail: List<T>) => List<T>
```

This removes the partial-application footgun and drops one closure allocation per element.

### Considerations

- **Broad mechanical refactor.** ~20+ operator definitions across `bigint`, `prime_field`, `bit_vec`, `string`, `monoid`, `number`, `range_map`, plus `operator` itself and the `foldToScan`/`reduceToScan`/`fold`/`reduce` plumbing in `list`. `genericMerge`/`cmpReduce`/`mergeTail` in `sorted_list` and the `range_map` merge consumers change accordingly.
- **`Fold` can no longer be `Binary<I, O, O>`.** This draws a clean line between combinators where currying is genuinely useful (`Binary`/`Equal`/`Unary`) and accumulators where currying is dangerous (`Fold`/`Reduce`/`StateScan`/`ReduceOp`/`TailReduce`).
- Could be split: `Fold`/`Reduce` first, `sorted_list`'s `ReduceOp`/`TailReduce` as a follow-up.

### Related

- [#763](https://github.com/functionalscript/functionalscript/pull/763) — the `StateScan` uncurry refactor this generalizes.

---

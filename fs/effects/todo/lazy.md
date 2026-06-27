# Make `Pure<T>` Lazy

**Priority:** P2
**Status:** open

## Problem

`Pure<T>` is currently represented as a strict wrapper:

```ts
export type Pure<T> = readonly [T]
```

A lazy list of effects therefore requires an additional thunk:

```ts
export type EffectList<O extends Operation, T> =
    Effect<O, () => NonEmpty<O, T> | undefined>
```

When the next list element is produced by an effect (for example, reading the next chunk from a file), evaluating one step requires:

1. Execute the effect.
2. Invoke the thunk.
3. Receive the next list cell.

The thunk is redundant in the effectful case because the effect itself is already the suspension point.

## Proposal

Represent `Pure<T>` as a lazy thunk instead:

```ts
export type Pure<T> = () => T
```

Then `EffectList` becomes:

```ts
export type EffectList<O extends Operation, T> =
    Effect<O, NonEmpty<O, T> | undefined>
```

The effect now returns the next list cell directly.

## Advantages

- Removes one function call from every effectful step of a lazy stream.
- Simplifies the representation of lazy effect lists.
- Makes `Effect` itself the single suspension boundary.
- Avoids wrapping lazy structures in an additional thunk.
- Better matches stream-like operations such as reading file chunks, network packets, or database rows.

## Disadvantages

- Accessing a pure value now requires a function call instead of an array access.
- Every pure value becomes a closure rather than a small tuple.
- A pure thunk may be evaluated multiple times unless memoized.
- Existing code using `readonly [T]` would require migration.

## Performance Considerations

This change trades a small overhead for standalone pure values in exchange for a faster representation of lazy effect streams.

In FunctionalScript, stream processing (for example, reading files chunk-by-chunk) is expected to be a much hotter execution path than creating isolated pure values. Optimizing `EffectList` is therefore likely to have a greater impact on overall performance than optimizing individual `Pure` values.

## Open Questions

- Should pure thunks remain call-by-name, or should they be memoized (call-by-need)?
- Should the runtime optimize trivial `pure(value)` closures specially?

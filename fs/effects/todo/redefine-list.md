# Redefine an effect list as `List<Effect<O, T>>`

Currently it's defined as

```ts
export type ListEffect<O extends Operation, T> =
    Effect<O, readonly[T, ListEffect<O, T>] | undefined>
```

The main problems is it's not lazy, so using creating a pure list may require a lot of computation and memory resources

## Proposal

```ts
export type EffectThunk<O extends Operation, T> =
    () => readonly[T, EffectList<O, T>] | undefined

export type EffectList<O extends Operation, T> =
    Effect<O, EffectThunk<O, T>>
```

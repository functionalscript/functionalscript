# Redefine an effect list as `List<Effect<O, T>>`

Currently it's defined as

```ts
export type ListEffect<O extends Operation, T> =
    Effect<O, readonly[T, ListEffect<O, T>] | undefined>
```

and it has a lot of problems.

1. It's not lazy, so using creating a pure list may require a lot of computation and memory resources, while any `List<T>` easy to convert to `List<Effect<O, T>>` by using `map`: `map(pure)(list)` and the operation is lazy.
2. The new structure requires new operations.

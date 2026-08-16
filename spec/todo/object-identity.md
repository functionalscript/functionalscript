# 7. Object Identity

Formerly §7 of the main [spec README](../README.md).

To build custom dictionaries when using functions as a key, we need either an object identifier (for hash map `O(1)`) or a proper comparison operator (for BTree map `O(log(n))`). The best option now is to use `<` and then use an array for items that satisfy `(a !== b) && !(a < b) && !(b > a)`.

One of the options is to use `Map`. The `Map` type is mutable and requires an object ownership tracking, similar to Rust — see [mutability](./mutability.md).

## 7.1. Hack For Map. Add `ReadonlyMap`

```ts
type ImmutableMap<K, V> = {
    readonly set(k: K, v: V): ImmutableMap<K, V>
    readonly delete(k: K): ImmutableMap<K, V>
}

const immutableMap = <K, V>(map: ReadonlyMap<K, V>) => ({
    set: (...kv: readonly[K, V]) => new Map([...map, kv])
    delete: (k: K) => new Map([...map.filter([k] => k !== k)])
})
```

## 7.2. Hack For Map. Special Instructions

```ts
// a special expression which is converted into one command.
new Map(a).set(k, v)

// a special expression which is converted into one command.
const b = new Map(a)
b.delete(k)
```

```ts
type ImmutableMap<K, V> = {
    readonly set(k: K, v: V): ImmutableMap<K, V>
    readonly delete(k: K): ImmutableMap<K, V>
}

const immutableMap = <K, V>(map: ReadonlyMap<K, V>) => ({
    set: (k: K, v: V) => new Map(map).set(k, v)
    delete: (k: K, v: V) => {
        const x = new Map(map)
        x.delete(k)
        return x
    }
})
```

# 7. Object Identity

Formerly §7 of the main [spec README](../README.md).

To build custom dictionaries when using functions as a key, we need either an object identifier (for hash map `O(1)`) or a proper comparison operator (for BTree map `O(log(n))`). The best option now is to use `<` and then use an array for items that satisfy `(a !== b) && !(a < b) && !(b > a)`.

One of the options is to use `Map`. The `Map` type is mutable and requires an object ownership tracking, similar to Rust — see [mutability](./mutability.md).

## Proposed `id` result contract

**Status:** proposed future feature, tentatively v2. Keep v1 simple; `id` is
not currently admitted and is not a v1 requirement. The result contract follows
the [working session](https://chatgpt.com/local/6af607d6-7994-8191-b9a8-1309ba7a700d).

For supported reference values within one identity scope:

- A successful `id` call returns a `bigint` that remains stable for that
  reference. This is the return type from the first version of the API.
- Two references have equal IDs if and only if they are equal under the VM's
  applicable reference-identity semantics. IDs are not reused within the scope.
- Results **need not be sequential**. Their numeric ordering carries
  no guarantee about object creation order or first ID request order.
- **Different VMs may provide different implementations** and return different
  concrete bigint values. No particular counter, nonce, permutation, sign or
  fixed integer width is required by this contract, and labels need not agree
  across VMs or independent executions.

Ordinary bigint equality and ordering still work within an execution, allowing
IDs to key ordered containers. Results derived from the concrete labels, such
as sorting them or comparing one with a literal, may also differ across VMs or
runs. This is a proposed feature-specific exception to successful-result
agreement, not permission to change the applicable reference-identity relation.
Its integration with purity and optimizer rules remains design work.

The [base TODO](../todo/object-identity-id.md) tracks admission and implementation;
the [obfuscation follow-up](../todo/object-identity-id-obfuscation.md) records one
possible implementation, also tentatively for v2.

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

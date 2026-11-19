# 7. Object Identity

Formerly §7 of the main [spec README](../README.md).

To build custom dictionaries when using functions as a key, we need either an object identifier (for hash map `O(1)`) or a proper comparison operator (for BTree map `O(log(n))`). The best option now is to use `<` and then use an array for items that satisfy `(a !== b) && !(a < b) && !(b > a)`.

One of the options is to use `Map`. The `Map` type is mutable and requires an object ownership tracking, similar to Rust — see [mutability](./mutability.md).

## Reference map

**Status:** implemented; the page is
[Finding a Reference](../built-ins/reference-map/README.md). This section
keeps the design record: what was decided, what was measured, and what was
not pursued.

### Decisions

The language designer, **sergey-shandar**, approved the feature, which
[DESIGN §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
requires before implementation, writing
["I approve the design."](https://github.com/functionalscript/functionalscript/pull/3805#issuecomment-6860283737)
on the pull request that filed the proposal, and accepted the rest in the
[working session](https://claude.ai/code/session_01Q2nX9uV9wfr4V8NeiJ3xb4):

- **The recognized function is the empty map, and it names itself.** A read
  of it answers the empty map itself, `return [undefined, empty]`, which keeps
  the interface the simplest for its user: one value, `empty`, and one rule
  for every map. The body is therefore a declaration that refers to its own
  name, where `entry` is an anonymous arrow: recognition matches the
  declaration and resolves the name to the function, the EDAG's `self`, and
  the serializer writes it as a named binding: a `const` inside an arrow
  called at once, `(()=>{const $0=($1,$2)=>{…};return $0;})()`, the form it
  gives every function that refers to itself, so that the text stands
  wherever a value does. Two shapes that avoid the name
  were considered and not taken: a factory, `refMap()` answering a new empty
  map, which replaces the one value with a call; and a read of `empty`
  answering a new map each time, which makes `empty(key)[1] === empty` false
  and the contract uneven.
- **Identity follows the rule of every helper.** One written body is one
  function wherever it is referred to, so an alias of `empty` is `empty`; the
  body written twice, in one module or in two, is two functions that are not
  `===`, on a JavaScript engine and compiled alike. The leaf is never merged
  with another.
- **The interpreters answer the node with the runtime's map**, not with a
  value of their own. Every evaluated value is an EDAG expression, which the
  serializer, the function-text renderer and the memo interpreter's call
  rely on, and a lookup table is not one; nor have the interpreters a store
  that lasts across invocations to keep it beside the map. So
  [`fjs/js/ref_map`](../../fjs/js/ref_map/module.f.js) writes the map in
  FunctionalScript alone, a list of pairs searched with `===`, and the
  runtime hands a new one out wherever the node is established. A map is
  then an ordinary function to an interpreter. Every answer is the same;
  a call takes `O(n)` steps there, and
  [a store](../../fjs/edag/todo/reference-map-store.md) is what would
  restore the bound. This replaces the value first accepted,
  `['refMap', index, sets]`.
- **The body is recognized by one matcher** that compares the parsed function
  with a canonical tree up to a consistent renaming of bindings. The body is
  about 35 lines, where `entry` is two statements; a further admitted body is
  one more tree.
- **The other observations of the function:** `m.length` is 2, and
  `String(m)` is one canonical text for every map, under the
  [function-source exception](../principles/README.md#function-source-representation-exception).
- **Names:** the leaf `refMap`, the module `fjs/types/ref_map`, and its export
  `empty`.
- **The open P1 of
  [statement-aware intrinsics](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)
  does not come first.** The matcher works on the same parsed syntax `entry`
  is matched on today.

### Several bodies, one instruction

Because the contract has no labels, bodies are interchangeable, and the
compiler can admit more than one and lower them all to the same native map. A
body is then only a choice of JavaScript performance. Each must agree with the
reference on every successful result, primitives included, and keep the
`O(log n)` bound; limits may differ, since
[failure is one outcome](../principles/README.md#failure-is-one-outcome).

Start with the body above: it is the simplest, having no limit and no guard.
On Node 22 with one million distinct keys it takes 2.5–2.8 s for the sets
and 1.1–1.2 s for the reads; the loop in `get` reads about 20% faster than
recursion. Bodies with other id arithmetic or storage were
measured under an earlier interface that took a flag in place of the optional
value, where the bigint body took 2.3–2.4 s and 1.1–1.3 s:

| Body | 1M sets | 1M gets | Note |
|---|---|---|---|
| double ids, `%` and `/` | about 1.7 s | about 0.8 s | 2⁵³ ids |
| int32 ids, `&` and `>>` | 1.4–1.6 s | 0.6–0.8 s | 2³¹ ids, needs a guard |
| int32 ids, 16-way trie | 1.1–1.3 s | 0.3–0.4 s | more code |
| one `Map` with undo records | about 0.4 s | — | not admissible |

The counter counts every distinct key ever set in a family, collected keys
included: 20 million short-lived keys set on one base map left the heap at
4 MB, so a bounded counter is reachable without exhausting memory. The undo
body mutates one `Map` in place and makes an older version replay the changes
between it and the newest, so its cost is the distance between versions, which
breaks the bound, and it accepts primitive keys, which the contract refuses.

### Serialization

Running the source on a JavaScript engine, a map is a closure, and it cannot
be serialized there, as no function can.

**Today.** An interpreter holds a map as the runtime's function, so a map is
written out as any function is, with no rule of its own:

- the empty map, never called, is the node itself and is written as the
  canonical body;
- a map that has been set is the runtime's function with its pairs, and is
  written as that function, the pairs its captured data.

Read back, such a map holds the same keys, each still the reference the rest
of the written value holds; a map met twice is one map, and two maps are two.
It is the runtime's map still, so its calls take `O(n)` steps wherever it is
read back, on a JavaScript engine too.

**With a native map.** An executor that holds a map as a value of its own
can write it as the expression that rebuilds it, a fold of its entries over
the empty map, which is the recognized map again once read back:

```js
[[key0, value0], [key1, value1]].reduce((m, [k, v]) => m(k, v)[1], empty)
```

The entries are ordinary data, one per key with the key's current value. That
uses the existing [function representation](./serialization.md) and
its sharing, which keeps a key the same reference as its other uses in the
graph, and adds no format. This is the form for NaNVM's map, and for the
interpreters once they have [a store](../../fjs/edag/todo/reference-map-store.md).

The map has no order, so the serializer supplies one from what it already
has: the entries are written in the order of their keys' positions in the
serialized graph. An entry whose key appears nowhere else in that graph is
left out, since nothing could pass that key to the map once it is read back.
A native map therefore retains its keys, which no call can observe, and
records no order.

A map is a function, so which map it is can be observed with `===` and by
using it as a key. A map met twice in the graph is written once and shared, as
any function is. A map other than the empty one is always written with at
least one set, so that reading it back makes a new map: where none of its
entries is left, it is written as one set of a key made for the purpose,
`empty({}, 0)[1]`, which nothing else can hold.

### Alternatives not pursued

- **`id(o)` returning a bigint**, with or without a reversible permutation of
  the labels. One command over existing types, but the label reaches results:
  exporting one, or an order derived from several, differs across VMs and
  runs, and needs a permanent exception to successful-result agreement.
- **`id` as a [runner effect](./io-effects.md).** Deterministic given
  the effect trace, but every lookup by a bare reference becomes effectful.
- **`Map` patterns** such as `new Map(m).set(k, v)`. Deterministic, but an
  update copies the map on a JavaScript engine, and `Map` is a new value type.
- **A map that issues its own keys.** Ordinary FunctionalScript, needing no
  language feature, but it cannot key on a reference the program already holds.
- **Other interfaces for the same map**: a flag or a command selecting read or
  set, whose result type then depends on an argument, and a get-or-create
  taking a callback, which cannot replace a value and loses what the callback
  itself adds to the map. Each is a wrapper over the one proposed.
- **A container with `size` and `entries` commands.** Usable without a
  separate ordered container, and its body is only a few lines longer, but
  the order of entries becomes observable. The ids cannot supply it: they are
  assigned across every map descended from one empty map, so a set whose
  result is discarded would change a later listing. Each entry then carries a
  per-map order number that every body and the VM must reproduce.


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

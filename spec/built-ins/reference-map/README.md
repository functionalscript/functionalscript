# Finding a Reference

**Status:** implemented

```js
const empty = (key, value) => {
    const ids = new WeakMap()
    let next = 1n
    const get = (node, i) => {
        while (true) {
            if (node === undefined) { return undefined }
            if (i === 1n) { return node.value }
            node = i & 1n ? node.one : node.zero
            i >>= 1n
        }
    }
    const set = (node, i, newValue) => {
        const { value, zero, one } = node ?? {}
        return i === 1n ? { value: newValue, zero, one } :
            i & 1n ? { value, zero, one: set(one, i >> 1n, newValue) } :
            { value, zero: set(zero, i >> 1n, newValue), one }
    }
    const make = root => {
        const self = (key, value) => {
            const existing = ids.get(key)
            const old = existing === undefined ? undefined : get(root, existing)
            if (value === undefined) { return [old, self] }
            const i = existing ?? next
            if (existing === undefined) { next += 1n }
            ids.set(key, i)
            return [old, make(set(root, i, value))]
        }
        return self
    }
    return value === undefined ? [undefined, empty] : make(undefined)(key, value)
}
const a = {};
const b = [];
const [, one] = empty(a, "an object");
const [, two] = one(b, "an array");
export default (...c) => two([a, b, {}][Number(c[0])])[0];
```

A program compares two references with `===`, and nothing else tells them
apart: there is no hash and no order of references, so a reference among
many is found by comparing it with each. The **reference map** is the one
thing that finds it faster. It is a function, and the empty one is `empty`,
the function the example begins with, which a program imports instead of
writing out:

```js
import { empty } from 'functionalscript/fjs/types/ref_map/module.f.js';
```

```ts
type RefMapKey = object | Function
type RefMap = (key: RefMapKey, value?: unknown) => RefMapResult
type RefMapResult = readonly [unknown, RefMap]
```

Every call answers the value `key` has in the map it is called on, and the
resulting map:

- `m(key)` is `[current, m]`: the value last set for `key`, or `undefined`
  where there is none, and the same map, the empty map included. Keys are
  compared as `===` compares references, so two objects with equal contents
  are two keys.
- `m(key, value)` is `[previous, m1]`, where `m1` is a new map with `key` set
  to `value`; `m` is unchanged. One call is a get-or-insert or a swap.
- A `value` of `undefined` is no value: the call is a read. A key cannot be
  set back to `undefined`, and there is no delete; a program that needs one
  stores its own marker, such as `null`.
- A primitive is never a key: reading one answers `undefined`, and setting
  one fails.
- A call takes at most `O(log n)` steps on every map, an older one included,
  where `n` is the number of distinct keys set since `empty`
  ([where it holds](#executors)).

The result has one shape whatever the arguments, so a computed `value` that
happens to be `undefined` gives a set that changes nothing, not a result of
another type.

## Only a mapping

There is no size, no iteration and no order. Those belong to the program's
own containers, such as a [B-tree](../../../fjs/types/btree/README.md): the
map gives a reference a key the program chooses, `m(key, next)` answering the
key it already has or assigning `next`, and the data lives under that key. A
program that drops many references builds a new map from `empty` with those it
keeps; the new map counts its own keys.

Every answer depends only on which keys were set. A map exposes no number for
a reference, so nothing a program computes differs between executors or runs,
and the [principles](../../principles/README.md) hold as written.

## The function

`empty` is recognized whole, as the
[`entry` helper](../../property-access/entries/README.md) is: the function
the example begins with, as the whole initializer of a `const`, under any
names and any layout. It is written once in
[`fjs/types/ref_map`](../../../fjs/types/ref_map/module.f.js) and imported
from there; a module that spells its own gets a map of its own, which is what
JavaScript gives it too.

The body reads its own name, so that a read of the empty map answers the
empty map, which is why only a `const` declaration can be it. `WeakMap`, the
captured `let` and the assignments are admitted in this function alone: a
function that departs from it by a step is an ordinary one, in which `new` is
refused as everywhere
([parser](../../../fjs/compiler/parser/README.md)). `WeakMap` is no reserved
word, so where a scope binds it the function is an ordinary one too. The
mutation is not observable.

Once recognized it is a function like any other: a value of `length` `2`,
`typeof` `"function"`, a new one wherever the declaration is written, and
passed, compared and used as a key as any function is. Its EDAG is the node
`['refMap']` ([`fjs/edag`](../../../fjs/edag/README.md)).

## Executors

Every executor gives the same answers. They differ in the bound and in a
map's text.

| Executor | The map | A call |
| --- | --- | --- |
| A JavaScript engine running the source | the function above | `O(log n)` |
| NaNVM | its own, a trie over each key's address ([`ref_map`](../../../nanvm/lib/src/vm/unstable/README.md)) | `O(log n)` |
| The EDAG interpreters | the runtime's, a list of pairs searched with `===` ([`fjs/js/ref_map`](../../../fjs/js/ref_map/module.f.js)) | `O(n)` |

The interpreters hold every value as an EDAG expression and have no store
that lasts across calls, so they have nowhere to keep a lookup table
([store](../../../fjs/edag/todo/reference-map-store.md)). A map one of them
has used is the runtime's function with its pairs, and is written out as
that; read back, it holds the same keys, each still the reference the rest
of the written value holds.

`String(m)` is the text of the function an executor holds: the canonical
body on NaNVM and for an unused `empty`, and the runtime's function for a map
an interpreter has used, as the
[function-source exception](../../principles/README.md#function-source-representation-exception)
allows.

The design, the alternatives and the measurements are in
[object identity](../../design/object-identity.md).

## Examples

The example is [`sample.f.js`](./sample.f.js), with the function written
out, since a demo is one module; [`demo.f.mjs`](./demo.f.mjs) shows its
outputs and calls it with `0`, `1` and `2`: the object, the array, and an
object the map never held.

## Reference

- ECMA-262: [`WeakMap`](https://tc39.es/ecma262/#sec-weakmap-objects)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap>

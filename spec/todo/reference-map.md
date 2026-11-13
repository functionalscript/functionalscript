## Add a reference map pattern

**Priority:** P4
**Status:** wip — design approved; implementation is a stack of pull requests

This replaces the earlier `id` proposal, which returned a bigint label for a
reference. The direction comes from the
[working session](https://claude.ai/code/session_01Q2nX9uV9wfr4V8NeiJ3xb4);
[alternatives](#alternatives-not-pursued) records why `id` was dropped.

### Problem

FJS can compare object and function references with `===`, but cannot derive a
hash or an ordering from that comparison, so a library cannot index arbitrary
references faster than a linear scan. `Map` and `Set` are not language types.

### Proposal

Recognize one function whole, as the
[`entry` helper](../property-access/entries/README.md) is: the **empty
reference map**. A reference map is a function, an existing value type:

```ts
type RefMapKey = object | Function
type RefMap = (key: RefMapKey, value?: unknown) => RefMapResult
type RefMapResult = readonly [unknown, RefMap]
```

Every call answers the value `key` has in the map it is called on, and the
resulting map:

- `m(key)` is `[current, m]`: the value last set for `key`, or `undefined`
  where there is none, and the same map. Keys are compared as `===` compares
  references: two objects with equal contents are two keys.
- `m(key, value)` is `[previous, m1]`, where `m1` is a new map with `key` set
  to `value`; `m` is unchanged. So one call is a get-or-insert or a swap.
- A `value` of `undefined` is no value: the call is a read. A key therefore
  cannot be set back to `undefined`, and there is no delete; a program that
  needs one stores its own marker, such as `null`.
- A primitive is never a key: reading one answers `undefined`, and setting one
  fails.
- There is nothing else: no iteration and no size.
- A call takes at most `O(log n)` steps on every map, an older one included,
  where `n` is the number of distinct keys set since the empty map. This
  bound is the point of the feature and part of its contract: with it a
  program can store and find references in its own containers in
  `O(log n)`, which `===` alone does not allow.

The result has one shape whatever the arguments, so a computed `value` that
happens to be `undefined` gives a set that changes nothing, not a result of
another type.

**A reference map is only a mapping.** Size, iteration, order and removal
belong to the program's own containers, such as a
[B-tree](../../fjs/types/btree/README.md): the map gives a reference a key the
program chooses, `m(key, next)` answering the key it already has or assigning
`next`, and the data lives under that key. The `Map` and `Set` values in
today's modules are used for all of those — `fjs/js/ast/memo` removes
`BindingId` object keys to shadow a scope, and many sites read `.size` or
spread a collection — and none of it becomes a command of the map.

A program that drops many references builds a new map from the empty one with
the references it keeps, in `O(k log k)` for `k` of them. The new map starts
its own count, so `n` and the memory held follow what was kept.

The reference body, checked on Node against a map copied on every set over
200 000 random operations across 50 live versions:

```js
/** @type {RefMap} */
const empty = (key, value) => {
    /** @type {WeakMap<RefMapKey, bigint>} */
    const ids = new WeakMap()
    let next = 1n
    // A node is `{ value, zero, one }`; the path to an id is its bits, low first.
    /** @type {(node: RefMapNode, i: bigint) => unknown} */
    const get = (node, i) => {
        while (true) {
            if (node === undefined) { return undefined }
            if (i === 1n) { return node.value }
            node = i & 1n ? node.one : node.zero
            i >>= 1n
        }
    }
    /** @type {(node: RefMapNode, i: bigint, newValue: unknown) => RefMapNode} */
    const set = (node, i, newValue) => {
        const { value, zero, one } = node ?? {}
        return i === 1n ? { value: newValue, zero, one } :
            i & 1n ? { value, zero, one: set(one, i >> 1n, newValue) } :
            { value, zero: set(zero, i >> 1n, newValue), one }
    }
    /** @type {(root: RefMapNode) => RefMap} */
    const make = root => {
        /** @type {RefMap} */
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
```

Its nodes have this type:

```ts
type RefMapNode = {
    readonly value: unknown
    readonly zero: RefMapNode
    readonly one: RefMapNode
} | undefined
```

The empty map holds no state: a read of it answers the empty map itself, as
a read of any map does, and each set on it starts a family of maps with its
own `WeakMap` and counter. The ids are sequential, so a plain binary trie over
their bits stays balanced and needs no rebalancing. The ids never leave the
closure.

### Why it needs no exception

Every answer depends only on which keys were set, never on a label, so results
are deterministic and agree with JavaScript. The
[principles](../principles/README.md) hold as written: the function is pure for
the optimizer, and a result may be cached across executions. The mutation in
the body is not observable; the pattern admits no general `WeakMap`, `let` or
property assignment.

The compiler lowers the recognized function to one native callable. Setting
returns another native callable that carries the new state; a call site is an
ordinary call on a function value. A native map that hashes on addresses must
retain its keys, which this body does not, so that an address cannot be reused
while its key is in a map.

### Serialization

Running the source on a JavaScript engine, a map is a closure, and it cannot
be serialized there, as no function can. An EDAG executor holds the map as a
native value and can serialize it as the expression that rebuilds it, a fold
of its entries over the empty map:

```js
[[key0, value0], [key1, value1]].reduce((m, [k, v]) => m(k, v)[1], empty)
```

The entries are ordinary data, one per key with the key's current value. That
uses the existing [function representation](../design/serialization.md) and
its sharing, which keeps a key the same reference as its other uses in the
graph, and adds no format.

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

### Alternatives not pursued

- **`id(o)` returning a bigint**, with or without a reversible permutation of
  the labels. One command over existing types, but the label reaches results:
  exporting one, or an order derived from several, differs across VMs and
  runs, and needs a permanent exception to successful-result agreement.
- **`id` as a [runner effect](../design/io-effects.md).** Deterministic given
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

### Where it lands

A recognized helper is an EDAG leaf: `entry` is the zero-operand node
`['entry']`, listed in [`fjs/edag`](../../fjs/edag/module.f.js) and repeated by
hand in the tag lists of analysis, sharing, the shared evaluator, the
serializers and the Rust output. The empty map is one more such leaf. What is
new is its result: no evaluated function carries state today except a closure,
so a map after a set is a new kind of evaluated value.

- The interpreters are FunctionalScript and cannot use `WeakMap`; they look
  keys up through the standard module, whose body runs on the host. This
  assumes an interpreter's reference values keep their host identity, so that
  the module sees the keys `===` sees.
- NaNVM builds every function with `static_function(code, length, frame,
  text)`, so a native function can hold a map in `frame` and return another.
  It needs a reference's identity as a number, which the VM interface may not
  offer yet.
- The parser's grammar reads the whole body, `new` and a captured `let`
  assigned from a nested function included, with one exception: `next++` as
  an operand. The body therefore counts in a statement of its own,
  `if (existing === undefined) { next += 1n }`.
- The WASM runtime keeps its own helper bodies and is out of scope: it refuses
  the map until a `todo/` of its own takes it.

### Decisions

The language designer, **sergey-shandar**, approved the feature, which
[DESIGN §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
requires before implementation, writing
["I approve the design."](https://github.com/functionalscript/functionalscript/pull/3805#issuecomment-6860283737)
on the pull request that files this proposal, and accepted the rest in the
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
- **The evaluated value of a map with state** is `['refMap', index, sets]`:
  an index for lookup and the list of sets for serialization.
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

### Tasks

A stack of pull requests on the one that files this proposal, each taking one
step ([SESSION.md](../../doc/SESSION.md)):

- [x] Settle the open decisions and record them here.
- [x] `edag`: add the `refMap` leaf — its id, types and schemas, and every
  hand-written tag list, unmergeable as `entry` is. Every executor and the
  Rust output refuse it; the JavaScript serializer writes the canonical body.
  No source reaches it yet.
- [x] `compiler/parser`: recognize the body and emit the leaf. Prove renamed
  bindings, layouts, and bodies that depart from it by one step, which are
  ordinary functions refused where they use `WeakMap`.
- [ ] `types/ref_map`: spell the pattern once, with its types and a proof of
  the contract against a map copied on every set: aliases, equal-content
  distinct objects, arrays and functions, a `value` of `undefined`, a read
  answering the same map, primitive keys, older versions after later sets,
  two families that share keys, and a read of the empty map answering the
  empty map.
- [ ] `edag`: evaluate maps in the shared evaluator, for both interpreters —
  the value, calls, `length`, equality and text — and prove the same cases.
- [ ] `compiler/serializer`: write a map as the fold that rebuilds it, entries
  in the order of their keys' positions and unreachable keys left out; prove
  that a map read back keeps its keys shared, and that a map none of
  whose keys is reachable is read back as a map of its own, not as the empty
  one.
- [ ] `nanvm`: the native map over `static_function` and `frame`, retaining
  keys, within the `O(log n)` bound.
- [ ] `rust/serializer`: emit the map, with harness fixtures and demos.
- [ ] `spec`: the specification page with a sample that keeps its data in an
  ordinary container under keys the map assigns; update the
  [design sketch](../design/object-identity.md) and the
  [capability gap](../../todo/037-language-design-map.md), and delete this
  file.

### Related

- [References in containers](../../todo/037-language-design-map.md) — the
  capability gap.
- [Object identity](../design/object-identity.md) — the design sketch.
- [Entry helpers](../property-access/entries/README.md) — functions the
  compiler already recognizes whole.

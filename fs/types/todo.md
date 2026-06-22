# TODO

## 92. Create a separate nominal type for MSB and LSB bit vectors.

**Priority:** P3
**Status:** open

---

## 141. Design for a universal, extensible type system based on custom RTTI.

**Priority:** P3
**Status:** open

How it should work:
1. We should define an interface for type validation. For example
   ```ts
   type TypeSystem<T> = (a: T) => {
       equal: (b: T) => boolean
       subset: (sub: T) => boolean
       // ...
   }
   type Info<T, S extends TypeSystem<S>> = T // this type will be used by other parsers to detect `typeof S`. TypeScript will see only `T`.
   ```
2. A user defines a data type and an implementation for the interface for type validations. For example:
   ```ts
   const type = null | undefined | ... as const
   const system: TypeSystem<typeof type> = {
       ...
   }
   type Map<T> = ...
   type Ts<T> = Info<Map<T>, typeof system> // always like this `Info<..., typeof ...>`!
   ```
4. A parser recognizes only a few constructions, for example:
   ```ts
   const t = null as const
   const a: Ts<typeof t> = ...
   ```

---

## 143. RTTI: Serializable Data Representation

**Priority:** P3
**Status:** open

A function-free, serializable representation of `Type` in [../fs/types/rtti/module.f.ts](../fs/types/rtti/module.f.ts), modeled after [../fs/bnf/data/](../fs/bnf/data/). The motivation is to give RTTI a clear two-form architecture and to move *all* schema algebra (union, subset, normalization, dispatch) off the thunk graph and onto a representation built for it.

### Principle

Two forms with one job each:

1. **Thunk form** — what users construct. Cheap, lazy, ergonomic. `or(...types)` simply captures its arguments; no flattening, no dedup, no subset analysis, no allocation surprise. Recursion uses self-referencing thunks. This is the construction surface and nothing more.
2. **Data form** — function-free, comparable, sortable, serializable. Every node has a stable structural identity. All schema algebra lives here: canonical ordering, structural equality, subset, union normalization, coverage collapse, and any future operations (intersection, negation, etc.).

`toData` is the single bridge. It runs once, lazily, when a consumer actually needs canonical form (validation, parsing, serialization, comparison). Schemas that are built but never consumed pay nothing.

#### Two parsers

A natural consequence of the two forms is two parsers:

- **Thunk-direct parser** — what `fs/types/rtti/validate/` and `fs/types/rtti/parse/` already are. Walks the thunk graph at dispatch time. Simple, no preprocessing, good for ad-hoc use.
- **Data-driven parser** — consumes a `RuleSet` produced by `toData`. Benefits from the canonical form: smaller dispatch tables, sub-set drops already applied, predictable variant ordering. Good for hot paths and for any consumer that needs the same schema many times.

Both should be supported. Users who don't care reach for the thunk parser; users who care about throughput or repeat use go through `toData` once and use the data parser.

#### What this implies

- Schema identity is a property of the *data* form, not the thunk form. Two `or(a, b)` calls produce two distinct thunks; `toData(or(a, b))` and `toData(or(b, a))` produce structurally identical data. This is the design, not a defect — do not add memoization to `or(...)` to "fix" thunk identity.
- The current `reduceOr` / `flattenOr` machinery in `or` is the wrong layer and should be removed when `toData` lands. See 130, which is superseded by this issue.

### Design

The concrete data shape still needs to be designed — this issue is the place to do that work. The design should be grounded in **set theory**: a `Type` denotes a set of values, and `or` is set union. The representation should make that structure explicit so that union, intersection, subset, and equality become straightforward operations rather than tag-by-tag case analysis.

Sketches of the direction to explore:

- **Top level is a union of subsets of non-overlapping kinds of data.** A schema is a disjoint union over a fixed set of "kinds" (e.g. `null`-ish, booleans, numbers, strings, bigints, arrays/tuples, records/structs). Each kind contributes its own sub-representation; the kinds do not overlap, so union/intersection/subset reduce to kind-wise operations.
- **Finite-domain kinds can be encoded as bitsets.** `null`, `undefined`, `true`, `false` are singletons of a fixed, small enumeration; a bitset captures any subset of them. `or(true, false)` then collapses to "boolean" simply because the corresponding bits are set; no special-case rule needed.
- **Arrays and tuples belong to the same kind.** A tuple is just an array whose length is constrained and whose positions carry distinct element types — the value sets overlap (e.g. `readonly [number]` ⊂ `readonly number[]`), so they must share a single representation rather than be separate variants.
- **Records and structs belong to the same kind**, for the same reason: a struct is a record whose keys are constrained and whose values carry distinct types per key.
- **Recursion via named/indexed references.** Following `fs/bnf/data/`, the overall shape can be a `Record<string, UnionSet>` or `readonly UnionSet[]`; nested types reference their definitions by name or index. Cycles become reference cycles in the map, not function thunks.

The right choice of primitives (which kinds, how each kind encodes its sub-set, how references are named) is the open question. Once fixed, `or` normalization, `equal`, `subset`, canonical ordering, and serialization all fall out from kind-wise set operations.

Prior art worth reading before committing to a shape: CDuce / Castagna's work on semantic subtyping, and BDD-based encodings of set-theoretic types — they have already worked out canonical forms and decidable subtyping for recursive types.

### Implications for `or`

Once the data form exists, `or` reverts to a one-line lazy constructor:

```ts
export const or = <T extends readonly Type[]>(...types: T): Or<T> =>
    () => ['or', ...types]
```

The existing `reduceOr` / `flattenOr` pass — and the test cases that exercise it — should be deleted. Equivalent behavior is re-established on the data form, where it generalizes uniformly across all operations and consumers.

### Downstream consumers

`validate` and `parse` keep their thunk-direct implementations unchanged. A data-driven variant is added that consumes a `RuleSet`. The two coexist.

### Related

- 130 — superseded by this issue. With the two-form architecture, "optimize `or`" is not a separate project: the canonical-form properties are properties of the data form by construction.
- [141](../../issues/README.md) — universal, extensible type system based on custom RTTI. The `equal`/`subset` predicates introduced here are the first concrete instance of the proposed `TypeSystem<T>` interface.

### Location

`fs/types/rtti/data/module.f.ts` (new), with `test.f.ts` alongside.

---

## 169. `types/map`: reuse `list`'s combinators instead of hand-rolled generators

**Priority:** P3
**Status:** open

`fs/types/map/module.f.ts` defines two private generator helpers solely to feed
`new Map(...)`:

```ts
// map/module.f.ts:6
const concat = <T>(x: Iterable<T>, y: Iterable<T>): Iterable<T> => ({
    *[Symbol.iterator]() { yield* x; yield* y }
})
// map/module.f.ts:13
const filter = <T>(i: Iterable<T>, p: (x: T) => boolean): Iterable<T> => ({
    *[Symbol.iterator]() { for (const x of i) { if (p(x)) { yield x } } }
})

export const mapSet    = (map, k, v) => new Map(concat(map, [[k, v]]))
export const mapDelete = (map, k)    => new Map(filter(map, ([xk]) => xk !== k))
```

These are the *only* hand-written `Symbol.iterator` generators in the `fs` tree
outside `fs/types/list/module.f.ts`, which already exports lazy `iterable`,
`concat`, and `filter` over its own `List` type
(`list/module.f.ts:80`, and its `concat`/`filter` combinators). The `map`
helpers re-implement the same two concepts (sequence concatenation and
predicate filtering) against raw `Iterable<T>`.

### The tension

A direct "import from `list`" is not mechanical: `list`'s combinators operate on
its `List<T>` thunk type, whereas `map` consumes a `ReadonlyMap` (a JS
`Iterable<[K,V]>`) and produces another via `new Map(...)`. Bridging would mean
`Iterable → List → combinator → Iterable`, which is more ceremony than the two
small generators it replaces.

So this is better framed as a *clarity / missed-reuse* observation than a clean
factory extraction, with two reasonable resolutions:

1. **Add a tiny `Iterable`-level layer.** A shared `fs/types/iterable` module
   (or a section of `list`) exposing `concat`/`filter` over plain `Iterable<T>`,
   which both `map` and any future iterable consumer reuse. This makes the
   generators a named, tested, shared concern instead of anonymous closures
   buried in `map`.

2. **Drop the generators entirely.** Because `new Map(...)` materializes its
   argument anyway, the lazy generators buy nothing here, and the bodies
   collapse to non-mutating standard operations:

   ```ts
   export const mapSet    = (map, k, v) => new Map([...map, [k, v]])
   export const mapDelete = (map, k)    => new Map([...map].filter(([xk]) => xk !== k))
   ```

   `.filter` is non-mutating, so this respects the no-mutation rule in
   `AGENTS.md`. This is the smaller, clearer change and removes ~14 lines.

### Recommendation

Prefer option 2 unless a second iterable consumer appears — it is the smaller,
clearer codebase and the laziness of the current generators is wasted in front
of `new Map`. Option 1 is the right move only once a third call site wants
`Iterable`-level `concat`/`filter`, at which point the "second consumer" rule is
satisfied.

### Caveats / why this is an idea, not a mechanical edit

- The payoff is modest (two tiny helpers). It is listed for clarity, not
  code-size: the value is removing the only stray generator implementations in
  the tree so sequence operations have one obvious home.
- If `map` later needs to stay lazy (e.g. very large maps where the intermediate
  array is costly), option 1 is preferable to option 2.

### Related

- [i161](todo.md) — the persistent-collection family;
  `map` is the JS-`Map`-backed sibling of the ordered collections discussed
  there.

---

## 172. RTTI: investigate one container skeleton for both `validate` and `parse`

**Priority:** P3
**Status:** open

`fs/types/rtti/validate` and `fs/types/rtti/parse` each expose a factory pair
that walks the same container shapes:

- `containerValidate` / `containerParse` — value-driven walk of `array`/`record`.
- `constContainerValidate` / `constContainerParse` — schema-driven walk of
  `tuple`/`struct`.

After i162 the two modules are
structurally parallel: same container guards (`isArray`/`isObject` from
`common`), same `Object.entries` traversal, same error-path bookkeeping
(`prependPath`, first-error). The only real difference is the success result:

- `validate` returns the **original** value unchanged — no fresh allocation —
  and short-circuits on the first error.
- `parse` **rebuilds** a fresh value from each item's parsed result
  (`rebuild(okEntries(results))`), mapping every item first.

### The idea

Collapse the four factories into two shared skeletons in `common`, each taking
an injected `build` callback:

```ts
// build = (value, results) => Result
// validate injects:  (value, _)       => ok(value)        // identity
// parse    injects:  (_, results)     => ok(rebuild(...))  // transformed
const container      = <K extends Tag1>(isContainer, build) => ...
const constContainer = <C>(isContainer, getItem, build) => ...
```

`validate` and `parse` would then be `container(isArray, identityBuild)` etc.
Net: 4 factories → 2 shared factories, with the per-module behavior expressed
purely as a `build` injection. (Note `Parse<T> = Validate<T>`, so the two
already share one signature — the type side is free.)

### The catch

The two walks are not the *same* algorithm today:

1. **Allocation.** `validate`'s contract is "returns the original value on
   success — no fresh allocation" (documented in its module header). A naive
   unified skeleton that always builds a `results` array to hand to `build`
   would make `validate` allocate an intermediate it then throws away.

2. **Short-circuit.** `validate` exits the loop on the first error; `parse`
   maps *every* item, then finds the first error. A merge has to pick one.
   Short-circuiting both is arguably an improvement for `parse`, but it means
   the injected `build` has to be fed incrementally (a fold threading a
   `Result`) rather than a finished array — which is the fiddly part.

3. **Casts.** Both modules already lean on `as any` to bridge the schema-driven
   generics (historically tracked in i146). Routing through one
   more generic `build` callback is unlikely to remove casts and may add a few.

### The `getItem` parameter and TS array string-indexing

`constContainer*` takes a `getItem(value, k)` accessor that differs between the
two const shapes:

```ts
const tupleParse = constContainerParse<ReadonlyArray<Unknown>>(
    isArray,
    (value, k) => value[Number(k)],  // tuple: string key → number index
    arrayRebuild,
)
const structParse = constContainerParse<ReadonlyRecord<string, Unknown>>(
    isObject,
    (value, k) => value[k],          // struct: string key directly
    arrayRebuild,
)
```

The split exists because the walk produces a **string** key (`Object.entries`
gives string keys for both arrays and objects), but TypeScript rejects indexing
an array with a string (`value[k]` where `k: string`) even though JavaScript
handles `arr['0']` fine. So the tuple branch round-trips through
`Number(k)` purely to satisfy the type checker.

We want a clean way to express "index this container by its entry key" that
works for both arrays and records **without** an `as` cast or the
`Number(k)` detour. Options to weigh:

- Keep the per-shape `getItem` injection (status quo): explicit, no cast, but
  asymmetric and a reason the tuple/struct factories can't fully merge.
- A small typed `at(container, key)` helper in `common`/`object` that accepts a
  string key and narrows internally (e.g. via `Object` index access) so callers
  never write the `Number(k)` conversion.
- Drive the tuple walk from numeric indices instead of `Object.entries` (so the
  key is already a `number` for arrays), and reconcile that with the record
  walk's string keys — at the cost of reintroducing the index/key split that
  i162 removed.

Whichever shared-skeleton design wins, it must settle this so a single
container accessor type-checks for arrays and records alike.

### Decision

Defer. The duplicated skeleton is ~15 readable lines per module; unifying it
trades that for a fold/`build` indirection plus a behavioral-semantics decision
(allocation + short-circuit) that a naive merge would paper over. The
abstraction clearly earns its keep once a **third** consumer of the same
container walk exists — most likely the serializable data form in
[i143](todo.md). Revisit then, designing the skeleton as a
short-circuiting `traverse` that lets the identity (`validate`) path avoid
allocation.

### Related

- i162 — made `parse` mirror
  `validate`'s factory pair (the precondition for this investigation).
- [i143](todo.md) — RTTI data form; the likely third consumer.
- i146 — the `Ts<T>` inference / `as any` problem both modules work around.

---

## 185. `byte_set`: build `range`/`one` from `bigint.mask`

**Priority:** P3
**Status:** open

`byte_set` hand-rolls contiguous bit masks that already exist as `bigint.mask`.

```ts
// fs/types/byte_set/module.f.ts:24
export const one: (n: Byte) => ByteSet
    = n => 1n << BigInt(n)

// fs/types/byte_set/module.f.ts:27
export const range: (r: readonly[Byte, Byte]) => ByteSet
    = ([b, e]) => one(e - b + 1) - 1n << BigInt(b)
```

```ts
// fs/types/bigint/module.f.ts:206
export const mask = (len: bigint): bigint =>
    (1n << len) - 1n
```

`range`'s `one(k) - 1n` is exactly `(1n << BigInt(k)) - 1n = mask(BigInt(k))`, so
the whole expression is a shifted `mask`:

```ts
one(e - b + 1) - 1n << BigInt(b)
// === (because subtraction binds tighter than `<<`)
(mask(BigInt(e - b + 1))) << BigInt(b)
```

`byte_set` is re-deriving `mask`'s `(1n << len) - 1n` via `one(k) - 1n` instead of
importing it.

### Proposed abstraction

Import `mask` from `bigint` and rewrite:

```ts
// fs/types/byte_set
import { mask } from '../bigint/module.f.ts'

export const range: (r: readonly[Byte, Byte]) => ByteSet
    = ([b, e]) => mask(BigInt(e - b + 1)) << BigInt(b)
```

`one` may stay as a single-bit shift (it reads clearly), or also be expressed as
the degenerate mask — but the clear win is `range`.

### Why this qualifies

- DRY: `bigint.mask` gains a genuine second consumer (it is currently used inside
  `bigint` and `bit_vec`); the bit-mask *arithmetic* belongs in `bigint`, not
  inlined in a byte-set codec.
- Separation of concerns in the spirit of [i178](../../issues/README.md) (move bit
  arithmetic to its natural home) — but a distinct pair (`byte_set` → `bigint`
  rather than `cbase32` → `bit_vec`).

### Caveats

- The operator-precedence reading matters: `one(e - b + 1) - 1n << BigInt(b)`
  parses as `(one(e-b+1) - 1n) << BigInt(b)`, which is exactly
  `mask(...) << BigInt(b)`, so the rewrite is behavior-preserving. The existing
  `byte_set` tests should confirm this.
- `has` (`byte_set/module.f.ts:15`, `((s >> BigInt(n)) & 1n) === 1n`) has no
  existing `bigint` equivalent; leave it as is — this issue is only about the
  `mask` duplication.
- Unrelated to the dead `nibble_set` of [i160](../../issues/README.md).

### Related

- [i178](../../issues/README.md) — same "bit arithmetic belongs in its numeric/bit module"
  theme.
- [i167](../../issues/README.md) — `bit_vec` re-binding flagged similarly.

---

## 193. `btree`: a shared `Path` fold engine for `set` and `remove` (investigate)

**Priority:** P3
**Status:** open

`btree/set` and `btree/remove` both finish the same way: walk the `find` result's
`tail` (a `Path<T>`) with `fold`, rebuilding each parent branch bottom-up by
dispatching on the child-slot index `i ∈ {0, 2, 4}`, then collapse a single-child
root.

```ts
// fs/types/btree/set/module.f.ts:17
const reduceOp
    : <T>(i: PathItem<T>) => (a: Branch1To3<T>) => Branch1To3<T>
    = ([i, x]) => a => {
    switch (i) {
        case 0: { /* rebuild left  */ }
        case 2: { /* rebuild mid   */ }
        case 4: { return b57([x[0], x[1], x[2], x[3], ...a]) }
    }
}
const reduceBranch = fold(reduceOp)
// …
const r = reduceBranch(f())(tail)        // :107
return r.length === 1 ? r[0] : r          // :108  (root collapse, see i179)
```

```ts
// fs/types/btree/remove/module.f.ts:83
const reduceX = <A, T>(ms: Array2<Merge<A, T>>) => ([i, n]: PathItem<T>) => (a: A): Branch<T> => {
    const [m0, m2] = ms
    switch (i) {
        case 0: { return f(m0) }
        case 2: { return f(m2) }
        case 4: { return [n[0], n[1], ...m2(a)([n[2], n[3], n[4]])] }
    }
}
const reduce = fold(reduceX([reduceValue0, reduceValue2]))   // :98
// …
const result = reduce(initReduce(tf)(first))(tt)             // :137
return result.length === 1 ? result[0] : result              // :138  (root collapse)
```

Both are `fold(<rebuild parent at PathItem index i ∈ {0,2,4}>)` over `Path<T>`,
dispatching on the same `0 | 2 | 4` slot positions of a `Branch3`/`Branch5`.
`remove` already generalized the rebuild via `reduceX(ms: Array2<Merge>)`; `set`'s
`reduceOp` is the same shape with the merge logic inlined.

### Proposed direction

Investigate a shared scaffold in `btree/types` (or `btree/find`) capturing
"fold a `Path<T>`, rebuilding the parent branch at slot `i` from a replacement
subtree", parameterized by the three slot handlers:

```ts
const foldPath = <A, T>(at0: …, at2: …, at4: …) => (seed: A) => (path: Path<T>) => …
```

`set` supplies its insert/merge handlers; `remove` supplies its `Merge`-based
ones. The single-child root collapse at the end is the separate
[i179](../../issues/README.md) `collapseRoot`.

### Why this qualifies

- Separation of concerns with a weak two-consumer DRY angle: the *path-fold
  dispatch on `{0,2,4}`* is genuinely shared scaffolding, distinct from the
  per-operation merge bodies.

### Caveats — why this is "investigate", not a mechanical edit

- The accumulator types differ: `set` threads `Branch1To3<T>`; `remove` threads
  `Branch<T>` and additionally splits the `Branch5` case
  (`[...ra([n0,n1,n2]), n3, n4]`, `remove:89`). The `case 4` handling also differs
  subtly between the two.
- A premature unification could obscure both algorithms. The right move is to
  first confirm the two handler signatures can be expressed over one
  `PathItem`-indexed interface without `as` casts, then extract.
- Lower confidence than the other entries in this batch — file as a design
  investigation.

### Related

- [i179](../../issues/README.md) — the shared single-child root collapse (the tail of both
  functions).
- [i164](../../issues/README.md) — uncurrying these same `fold` accumulators; complementary
  to extracting the fold itself.

---

## 195. Improve `listToVec` from `bit_vec` by changing concatenation order.

**Priority:** P3
**Status:** open

Instead of
`(((((a + b) + c) + d) + e) + f)` which can be very slow for huge bigint, we can do
`(((a + b) + (c + d)) + (e + f))`. The number of operations that works with huge bigints is much smaller, $O(n)$ vs $O(\log n)$. We will still use the `fold` operation, but it will accumulate a binary tree branch. We can make this algorithm generic.

---

## 662. RTTI `ts` printer: walk the `Type` ADT through the shared `visit`

**Priority:** P4
**Status:** open

### Problem

`fs/types/rtti/common/module.f.ts` exports `visit` — a visitor over the
`Type` ADT — and its module header states its purpose plainly:

> Shared kernel for RTTI consumers (`validate`, `parse`).
> …
> `visit`: a visitor over the `Type` ADT. Callers supply a `Visitor<R>`
> with one handler per variant; `visit(v)(rtti)` recognizes `rtti` and
> calls the matching handler. Both consumers compose their top-level
> function from a visitor.

`visit` does the whole job of recognizing a schema: evaluate a `Thunk`
once, switch on its tag (`const` / `array` / `record` / `unknown` / `or` /
a `Tag0` primitive), and route a bare `Const` through `visitConst`
(tuple / struct / `constPrimitive`).

```ts
// fs/types/rtti/common/module.f.ts:124
export const visit = <R>(v: Visitor<R>) => (rtti: Type): R => {
    if (typeof rtti === 'function') {
        const [tag, ...value] = rtti()
        switch (tag) {
            case 'const': return visitConst(v)(value[0] as Const)
            case 'array': return v.array(value[0])
            case 'record': return v.record(value[0])
            case 'unknown': return v.unknown()
            case 'or': return v.or(value)
        }
        return v.primitive0(tag as Primitive0)
    }
    return visitConst(v)(rtti)
}
```

```ts
// fs/types/rtti/common/module.f.ts:99
const visitConst = <R>(v: Visitor<R>) => (c: Const): R =>
    typeof c === 'object' && c !== null
        ? (commonIsArray(c) ? v.tuple(c) : v.struct(c as Struct))
        : v.constPrimitive(c as Primitive)
```

`validate` and `parse` both compose their top-level function from a
`Visitor<R>` and call `visit(...)`. But there is a **third** walker over
the same `Type` ADT in the same `rtti/` tree — the runtime `printer` in
`fs/types/rtti/ts/module.f.ts` — and it never adopted `visit`. It
re-hand-rolls the identical recognition logic:

```ts
// fs/types/rtti/ts/module.f.ts:118
export const printer = (mut?: true): (rtti: Type) => string => {
    const { tuple, struct, array, record } = tsPrinter(mut)

    const constToTs = (rtti: Const): string =>
        typeof rtti !== 'object' || rtti === null ? primitive(rtti) :
        rtti instanceof Array ? tuple(rtti.map(toTs)) :
        struct(Object.entries(rtti).map(([k, v]) => [k, toTs(v)]))

    const toTs = (rtti: Type): string => {
        if (typeof rtti !== 'function') { return constToTs(rtti) }
        const [tag, ...rest] = rtti()
        switch (tag) {
            case 'const': return constToTs(rest[0] as Const)
            case 'array': return array(toTs(rest[0]))
            case 'record': return record(toTs(rest[0]))
            case 'or': return union(rest.map(toTs))
            default: return tag // tag0: 'boolean' | 'number' | 'string' | 'bigint' | 'unknown'
        }
    }

    return toTs
}
```

`constToTs` is `visitConst` with the leaves swapped (`primitive` / `tuple` /
`struct` instead of `constPrimitive` / `tuple` / `struct`). The `toTs`
`switch` is the `visit` `switch` with `array` / `record` / `or` swapped
for printer leaves and the `default` arm returning the tag string. The
schema-recognition skeleton — the part `visit` exists to own — is copied
verbatim, including the `typeof rtti === 'function'` thunk gate, the
`rtti()` evaluation, the array-vs-object Const split, and the
`null`-as-primitive handling.

### Proposal

Express the printer as a `Visitor<string>` and delegate recognition to
`visit`. Every printer leaf maps one-to-one onto a visitor handler, so the
hand-rolled `constToTs` and the `toTs` switch both disappear:

```ts
import { visit, type Visitor } from '../common/module.f.ts'

export const printer = (mut?: true): (rtti: Type) => string => {
    const { tuple, struct, array, record } = tsPrinter(mut)
    const visitor: Visitor<string> = {
        tuple:          t  => tuple(t.map(toTs)),
        struct:         s  => struct(Object.entries(s).map(([k, v]) => [k, toTs(v)])),
        array:          e  => array(toTs(e)),
        record:         e  => record(toTs(e)),
        or:             vs => union(vs.map(toTs)),
        constPrimitive: c  => primitive(c),
        primitive0:     t  => t,           // 'boolean' | 'number' | 'string' | 'bigint'
        unknown:        () => 'unknown',
    }
    const toTs = visit(visitor)
    return toTs
}
```

The handlers reference `toTs` (the recursive call), which is `visit(visitor)`;
the arrow functions capture the `toTs` binding, and no handler runs during
construction, so the const-before-use is safe — the same lazy-recursion
shape `validate`/`parse` already rely on.

This is **separation of concerns**, not just DRY: schema recognition
(thunk gate, tag switch, Const split, null handling) belongs in the one
place that owns the `Type` ADT shape — `common.visit` — and the printer
should own only the *rendering* of each variant. Today the printer owns
both, so a future `Type` variant (a new `Tag1`, say) has to be added to
`visit`'s switch **and** to `toTs`'s switch independently; with this
change the printer gets a compile error from `Visitor<string>` until it
supplies the new leaf, which is exactly the safety `validate`/`parse`
already enjoy.

### Why the mapping is exact

| `visit` routes to | current printer code | visitor handler |
|---|---|---|
| `v.tuple(c)` (Const array) / `'const'`→array | `tuple(rtti.map(toTs))` | `t => tuple(t.map(toTs))` |
| `v.struct(c)` (Const object) | `struct(Object.entries(rtti)…)` | `s => struct(Object.entries(s)…)` |
| `v.constPrimitive(c)` | `primitive(rtti)` | `c => primitive(c)` |
| `v.array(e)` | `array(toTs(rest[0]))` | `e => array(toTs(e))` |
| `v.record(e)` | `record(toTs(rest[0]))` | `e => record(toTs(e))` |
| `v.or(value)` | `union(rest.map(toTs))` | `vs => union(vs.map(toTs))` |
| `v.primitive0(tag)` | `default: return tag` | `t => t` |
| `v.unknown()` | `default: return tag` (`'unknown'`) | `() => 'unknown'` |

The two behaviours the printer documents in its JSDoc are preserved:

- **`unknown` prints the literal `'unknown'`** (TS built-in), not
  `DjsUnknown`. In `visit`, `'unknown'` is a *separate* arm
  (`case 'unknown': return v.unknown()`), distinct from the `Tag0`
  primitives, so `unknown: () => 'unknown'` keeps the documented string
  while `primitive0: t => t` covers `'boolean' | 'number' | 'string' |
  'bigint'`. The current code lumps both into the `default` arm; the split
  is harmless because both arms produce the tag string anyway.
- **`null` Const prints as a primitive.** `visitConst` routes
  `typeof c === 'object' && c !== null` away from `constPrimitive`, so
  `null` falls to `v.constPrimitive(null)` → `primitive(null)`, matching
  `constToTs`'s `rtti === null ? primitive(rtti)` guard.

`tsPrinter`'s leaf signatures already line up with the visitor:
`tuple: (string[]) => string`, `struct: ([string,string][]) => string`,
`array: (string) => string`, `record: (string) => string`
(`fs/types/ts/module.f.ts:23-29`), with `union` and `primitive` from the
same module (`:44`, `:55`).

### Why this qualifies

- **Separation of concerns** (always appropriate per `AGENTS.md`, no
  second-consumer bar required): the `Type`-ADT recognition skeleton has a
  natural home — `common.visit` — and the printer is currently the only
  RTTI walker that keeps a private copy of it instead of importing it.
- **DRY at the right altitude**: `visit` already serves `validate` and
  `parse`; the printer is the third real consumer of the same walk. The
  skeleton (`typeof === 'function'` gate, `rtti()` eval, tag switch,
  array/object Const split, null handling) is currently maintained twice.
- **Removes `as` casts.** `toTs` carries `rest[0] as Const`; `visit`/`visitConst`
  already localise the unavoidable casts (`value[0] as Const`,
  `c as Primitive`) inside `common`, so the printer's visitor handlers
  need none — aligning with the `AGENTS.md` push to avoid `as`.

### Caveats / why this is an idea, not a mechanical edit

- **Import direction / cycle.** `common` already does
  `import type { Ts } from '../ts/module.f.ts'` (type-only). Adding
  `import { visit } from '../common/module.f.ts'` to `ts` makes the two
  modules co-dependent at compile time. At **runtime** the edge is
  one-directional (`ts → common`; the `common → ts` import is `import type`
  and erased), so there is no initialization-order hazard — but confirm
  `npx tsc` and `npm test` stay green, since circular type graphs
  occasionally surface `slow types` complaints under JSR
  (i147).
- **Generic inference.** Unlike `validate`/`parse`, whose visitors return a
  generic `Validate<T>` and lean on a top-level `as any`
  (historically tracked in i146), the printer's visitor is
  monomorphic (`Visitor<string>`), so it should type cleanly with **no**
  cast. If TS nonetheless balks at one of the handler parameter types
  (`Struct`, `Primitive`), prefer fixing the handler signature over
  reintroducing `as`.
- **Scope.** This is independent of [i172](todo.md),
  which proposes merging the `validate`/`parse` **container factories**.
  That is about the value-walk; this is about the schema-walk in the
  printer. Either can land without the other.

### Related

- [i172](todo.md) — unify `validate`/`parse`
  container walks; complementary RTTI consolidation along the same kernel.
- i146 — the `Ts<T>` inference / `as any` problem in the generic visitors;
  the printer's visitor avoids it by being monomorphic.
- [i197](../djs/todo.md) — a sibling "adopt a shared visitor"
  proposal, but over runtime `Unknown` *values* rather than the `Type`
  schema ADT; same spirit, different walk.
- [i143](todo.md) — the prospective fourth `Type`-ADT consumer
  (the serializable data form); a printer already on `visit` is one fewer
  fork it has to reconcile with.

- `fs/types/rtti/common/module.f.ts:99,124` — `visitConst` / `visit`, the
  shared schema walker.
- `fs/types/rtti/ts/module.f.ts:118-145` — the printer's duplicated
  `constToTs` + `toTs` switch.
- `fs/types/ts/module.f.ts:23-29,44,55` — the printer leaves the visitor
  handlers delegate to.

---

## 666-json-schema-visit. Route `toJsonSchema` through `rtti/common.visit`

**Priority:** P3
**Status:** open

### Problem

`fs/types/rtti/common/module.f.ts` exports `visit` — the "shared kernel for RTTI
consumers", a `Visitor<R>` over the `Type` ADT. `validate` and `parse` both
delegate schema recognition to it (`fs/types/rtti/validate/module.f.ts:176`,
`fs/types/rtti/parse/module.f.ts:202`). Issue [i662](todo.md)
proposes routing the `ts` printer through it too, as a *third* consumer.

`toJsonSchema` is a **fourth** hand-rolled walker over the same ADT, and i662 does
not mention it. Its own module doc even says it "mirrors the visitor structure of
`fs/types/rtti/ts/`" — i.e. it copies the exact skeleton i662 wants to eliminate.
The recognition logic is duplicated verbatim:

```ts
// fs/json/schema/module.f.ts:119-135      // fs/types/rtti/common/module.f.ts:124-137
export const toJsonSchema = (rtti) => {     export const visit = v => rtti => {
  if (typeof rtti !== 'function')             if (typeof rtti === 'function') {
    { return constToJsonSchema(rtti) }          const [tag, ...value] = rtti()
  const [tag, ...rest] = rtti()                 switch (tag) {
  switch (tag) {                                  case 'const': return visitConst(v)(value[0] as Const)
    case 'const': return constToJsonSchema(...)   case 'array': return v.array(value[0])
    case 'array': return {type:'array', ...}      case 'record': return v.record(value[0])
    case 'record': return {type:'object', ...}    case 'unknown': return v.unknown()
    case 'or': return {anyOf: rest.map(...)}       case 'or': return v.or(value)
    ...                                          }
                                                  return v.primitive0(tag as Primitive0)
                                                }
                                                return visitConst(v)(rtti)
```

and `constToJsonSchema` (`fs/json/schema/module.f.ts:72-100`) is `visitConst`
(`common:94-97`) with the leaves swapped — same `typeof !== 'object' || === null`
primitive test, same `instanceof Array` tuple-vs-struct split. The thunk gate, the
`rtti()` evaluation, the `Const` array/object split, and `null`-as-primitive are all
maintained a fourth time, each behind an `as Const` cast (`json/schema:123`) that
`visit`/`visitConst` already localize inside `common`.

With four independent copies, any new `Type` variant must be added in four places
with no compiler help. `validate`/`parse` get exhaustiveness safety from the
`Visitor<R>` shape; `toJsonSchema` doesn't.

### Proposal

Express `toJsonSchema` as a `Visitor<Unknown>` and let `visit` own recognition —
the same move i662 proposes for the `ts` printer:

```ts
import { visit, type Visitor } from '../../types/rtti/common/module.f.ts'

const visitor: Visitor<Unknown> = {
    tuple:          t  => ({ type: 'array', prefixItems: t.map(toJsonSchema), items: false }),
    struct:         s  => structSchema(s),        // keeps required/stripUndefined logic (:88-99)
    array:          e  => ({ type: 'array', items: toJsonSchema(e) }),
    record:         e  => ({ type: 'object', additionalProperties: toJsonSchema(e) }),
    or:             vs => ({ anyOf: vs.map(toJsonSchema) }),
    constPrimitive: c  => constPrimitiveSchema(c), // bigint→{const:Number}, undefined→{not:{}}, null→{const:null}
    primitive0:     t  => ({ type: t === 'bigint' ? 'integer' : t }),
    unknown:        () => ({}),
}
export const toJsonSchema = visit(visitor)
```

The JSON-Schema-specific bits stay in the handlers: the struct handler keeps its
`required`/`stripUndefined`/`admitsUndefined` computation, and `constPrimitive`
keeps the `bigint`→`Number`, `undefined`→`{not:{}}`, `null`→`{const:null}` special
cases. `visitConst` already routes `null` to `constPrimitive`, matching the current
`rtti === null` guard.

This is a separation-of-concerns fix (no second-consumer bar needed — `visit` is
already the home for this walk). `json/schema` already imports from `rtti`, so no
import cycle is introduced (cleaner than i662's `ts→common` case). The visitor is
monomorphic (`Visitor<Unknown>`), so no top-level `as`/`any` is needed.

**Best landed together with i662** as "route *all* remaining `Type`-ADT printers
through `visit`."

### Tasks

- [ ] rewrite `toJsonSchema` as a `Visitor<Unknown>` driven by `visit`
- [ ] move struct/`constPrimitive` JSON-Schema specifics into handlers, drop the `as Const` cast
- [ ] confirm `fs/json/schema/proof.f.ts` passes unchanged (pure refactor)

### Related

- [i662](todo.md) — same move for the `ts` printer; land together
- [i172](todo.md) — the `validate`/`parse` container skeleton
- `fs/types/rtti/common/module.f.ts` — `visit` (:124), `Visitor` (:83)
- `fs/json/schema/module.f.ts` — `toJsonSchema` (:119), `constToJsonSchema` (:72)

---

## 668-rtti-function-types. Add RTTI support for function values

**Priority:** P3
**Status:** open

### Problem

RTTI can describe data shapes, but it cannot currently describe function values
as first-class schemas. Some consumers need to express a callable value together
with its parameter and result types, for example emergent testing proof leaves.

Function RTTI has an important limitation: while we can describe the parameter
and result types, runtime validation of a function itself has limited options.
A value can be checked as callable, but its full contract can only be observed
when the function is called.

### Proposal

Add an extern RTTI form for functions. It should be able to describe parameter
types and result type, while keeping the runtime contract explicit: validating a
function schema should not pretend it can prove all future calls are valid.

One practical API is a wrapper that validates calls:

```ts
validateFunc<F extends RttiFunction>(
    rtti: F,
    f: (...params: readonly unknown[]) => unknown,
): (...params: TsParams<F>) => Result<TsResult<F>, unknown>
```

The wrapper validates parameters before calling `f` and validates the result
after the call. Errors from validation or from the function body are returned as
`Result` errors.

For untrusted code, provide a sandboxed wrapper:

```ts
validateSandboxFunc<F extends RttiFunction>(
    rtti: F,
    f: (...params: readonly unknown[]) => unknown,
): (...params: TsParams<F>) => Effect<Sandbox, Result<TsResult<F>, unknown>>
```

This preserves the same typed call surface while running the function through a
sandbox effect, which is better for cases where the function body should not be
trusted.

### Tasks

- [ ] Design the extern RTTI representation for function schemas.
- [ ] Define `TsParams<F>` and `TsResult<F>` for function RTTI.
- [ ] Decide what minimal validation is performed on the raw value before it is
  wrapped.
- [ ] Add a call-validating wrapper that returns `Result<TsResult<F>, unknown>`.
- [ ] Add or design a sandboxed wrapper that returns
  `Effect<Sandbox, Result<TsResult<F>, unknown>>`.
- [ ] Document the runtime limitation: function RTTI describes callable
  contracts, but the contract is enforced at call boundaries.

### Related

- [i668-emergent-testing-proof-type](../emergent_testing/todo.md) —
  proof leaves need function-valued schemas if `Proof` is derived from RTTI.
- [i143-rtti-data](todo.md) — serializable/function-free RTTI data
  form; extern function schemas may need to remain outside that core form.

---

## 66B-sorted-list-cmp-reduce-factory. `sorted_list`: share the compare-and-select reduce shape

**Priority:** P5
**Status:** open

### Problem

`fs/types/sorted_list/module.f.ts` defines two `ReduceOp<T, null>` constructors
for `genericMerge` that are identical except for the value they place in the
first tuple slot:

```ts
// :48-51
const cmpReduce = <T>(cmp: Cmp<T>): CmpReduceOp<T> => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, null]
}

// :57-60
const intersectReduce = <T>(cmp: Cmp<T>): ReduceOp<T, null> => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, null]
}
```

Both share the entire skeleton — the `() => a => b =>` shape, the
`const sign = cmp(a)(b)` comparison, and the `[…, sign, null]` return envelope.
They differ only in how the first element is selected from `sign`/`a`/`b`:
`merge` keeps the larger (`sign === 1 ? b : a`), `intersect` keeps the equal one
or drops it (`sign === 0 ? a : null`).

### Proposal

Factor the shared skeleton into one factory parameterized by the selector,
deriving both reducers point-free:

```ts
const cmpReduceBy = <T>(select: (sign: Sign, a: T, b: T) => Nullable<T>) =>
    (cmp: Cmp<T>): ReduceOp<T, null> => () => a => b => {
        const sign = cmp(a)(b)
        return [select(sign, a, b), sign, null]
    }

const cmpReduce = cmpReduceBy<unknown>((sign, a, b) => sign === 1 ? b : a)
const intersectReduce = cmpReduceBy<unknown>((sign, a, b) => sign === 0 ? a : null)
```

The compare-and-thread-`sign` mechanics live once; only the per-operation
selection rule remains at each derivation, which is the genuine difference
between "merge" and "intersect".

### Why this is filed at P5

This is borderline against the `AGENTS.md` "readability over DRY for short, clear
functions" guidance — the originals are three lines each and already readable,
and the `select` callback adds an indirection a reader must follow. It is the
same caliber as [i66A-emergent-add-result](../emergent_testing/todo.md) (two
near-identical updaters differing in one slot), filed at the same low priority:
worth doing if the file is being touched anyway, or as a prerequisite if a third
sign-driven merge reducer is added (e.g. set difference), but not on its own.

### Tasks

- [ ] Add `cmpReduceBy` and derive `cmpReduce` / `intersectReduce` from it.
- [ ] Confirm `fs/types/sorted_list/proof.f.ts` still passes (`fjs t`) with full
      branch coverage and `npx tsc` is clean.

### Related

- i180-sorted-set-intersect-symmetry —
  adjacent sorted-collection merge/intersect cleanup.
- [i66A-emergent-add-result](../emergent_testing/todo.md) — the same
  "two updaters differing in one slot" pattern, filed at the same priority.

---

## 66D-ts-printer-tuple-readonly-fold. `types/ts`: fold the `tuple` readonly branch through `ro`

**Priority:** P5
**Status:** open

### Problem

`fs/types/ts/module.f.ts`'s `printer` already computes the readonly prefix once
as `ro`, then uses it for `struct`, `array`, and `record` — but `tuple`
re-derives the same `mut` distinction with a whole second `complex(...)` call
instead of reusing `ro`:

```ts
// :31-40
export const printer = (mut?: true): Printer => {
    const ro = mut ? '' : 'readonly'
    return {
        tuple: (mut ? complex('[', ']') : complex('readonly[', ']')),
        struct: (fields) => structX(fields.map(([k, v]) => `${ro}${JSON.stringify(k)}:${v}`)),
        array: (type: string) => `${ro}(${type})[]`,
        record: (type: string) => structX([`${ro}[k in string]?:${type}`]),
    }
}
```

The two `complex(...)` arms differ only in the `'readonly'` prefix on the open
bracket — which is exactly what `ro` already encodes (`'readonly['` when not
`mut`, `'['` when `mut`). The ternary makes a reader confirm the two arms are
identical except for that token, the same diff cost AGENTS.md's branch-sharing
rule targets ("refactor so the shared part appears once and only the difference
lives in the conditional").

### Proposal

Drop the per-`tuple` ternary and build the open delimiter from `ro`, matching how
`struct` / `array` / `record` already consume it:

```ts
tuple: complex(`${ro}[`, ']'),
```

Behaviour is unchanged (`readonly[…]` when immutable, `[…]` when `mut`); the
`mut`/`readonly` decision now lives in exactly one place (`ro`) for all four
emitters.

### Why this is filed at P5

A one-line readability cleanup in a single module — worth doing if the file is
touched anyway, not on its own.

### Tasks

- [ ] Replace the `tuple` ternary with `complex(\`${ro}[\`, ']')`.
- [ ] Confirm `fs/types/ts/proof.f.ts` still passes (`fjs t`) with both the
      mutable and readonly tuple paths covered and `npx tsc` is clean.

### Related

- [i662-rtti-ts-printer-visit](todo.md) — adjacent
  `ts` printer work.

---

## 66F-btree-remove-mirror-merge. `btree/remove`: collapse the left/right mirror-image merge helpers (investigate)

**Priority:** P4
**Status:** open

### Problem

`fs/types/btree/remove/module.f.ts` defines two pairs of merge helpers that are
**left/right mirror images** of each other — identical control flow, with the
sibling tuple and the placement of the merged leaf swapped:

```ts
// fs/types/btree/remove/module.f.ts:31-42  (left)
const reduceValue0 = <T>(a: Branch<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
    const [, v1, n2] = n
    if (a.length === 1) {
        switch (n2.length) {
            case 3: { return [[a[0], v1, ...n2]] }
            case 5: { return [[a[0], v1, n2[0]], n2[1], [n2[2], n2[3], n2[4]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [a, v1, n2]
    }
}

// fs/types/btree/remove/module.f.ts:44-55  (right — mirror of the above)
const reduceValue2 = <T>(a: Branch<T>) => (n: Branch3<T>): Branch1<T> | Branch3<T> => {
    const [n0, v1, ] = n
    if (a.length === 1) {
        switch (n0.length) {
            case 3: { return [[...n0, v1, a[0]]] }
            case 5: { return [[n0[0], n0[1], n0[2]], n0[3], [n0[4], v1, a[0]]] }
            default: { throw 'invalid node' }
        }
    } else {
        return [n0, v1, a]
    }
}
```

The same mirroring holds for `initValue0` (`:57-68`) vs `initValue1` (`:70-79`):
identical structure, with `a` placed left vs right and the sibling read from the
opposite end. The two pairs are already consumed symmetrically — `reduceX` is
fed `[reduceValue0, reduceValue2]` (`:98`) and `[initValue0, initValue1]`
(`:100`), and `reduceX` itself dispatches `case 0 → m0`, `case 2 → m2`.

So the module encodes "left vs right" **three times**: once in `reduceX`'s
`switch (i)`, and once in each mirror pair. Changing the rebalancing invariant
means editing both halves of each pair in lockstep — a maintenance hazard the
type checker cannot catch, since both halves type-check independently.

### Idea (investigate)

Parameterize each pair on a side descriptor instead of writing the mirror out by
hand. The two halves differ only in:

- which slot of `n` is the *value* neighbour vs the *sibling* (front vs back),
- whether the merged leaf `a` is prepended or appended.

A small `side`-indexed helper (or a tuple-reversal applied at the boundary)
could express the merge once and derive both directions, leaving `reduceX`'s
`[m0, m2]` array as the single place that names left vs right.

**Caveat — readability tradeoff.** Mirror-image code is a known case where naive
DRY can *hurt* clarity: a `reverse`-everything-conditionally helper can read
worse than two explicit, locally-readable blocks, which `AGENTS.md` warns
against (readability over deduplication). The deliverable of this issue is the
investigation: prototype the parameterized form and keep it **only if** it is at
least as readable as the current four functions. If not, close as won't-fix and
record the decision (the duplication is the accepted cost of readability).

### Tasks

- [ ] Prototype a side-parameterized merge that derives `reduceValue0`/`2` from
      one definition; do the same for `initValue0`/`1`.
- [ ] Compare readability against the current explicit pairs.
- [ ] Keep only if clearer; otherwise close won't-fix with the rationale
      recorded in the module's `README.md` / JSDoc.

### Related

- [i193-btree-path-fold-engine](todo.md) — shares the
  cross-module `fold`/`reduceX` Path-walk engine between `set` and `remove`;
  this issue is the orthogonal, *within-`remove*` left/right mirror collapse.

---

## 161. `string_set` and `ordered_map`: a shared keyed B-tree collection

**Priority:** P3
**Status:** open

`fs/types/string_set/module.f.ts` and `fs/types/ordered_map/module.f.ts` are
parallel thin wrappers over the same B-tree primitives
(`btree/find`, `btree/set`, `btree/remove`, `btree/module`) keyed by the same
string comparator (`string/module.f.ts` `cmp`). A set is logically a map whose
key *is* its value, and that relationship shows up directly in the code.

```ts
// string_set — key === value
export const contains = value => { const f = find(cmp(value)); return s => s !== null && isFound(f(s).first) }
export const set      = value => btreeSet(cmp(value))(() => value)
export const remove   = compose(cmp)(btreeRemove)
export const values   = btValues
export const empty    = btEmpty

// ordered_map — key is entry[0]
const keyCmp  = a => ([b]) => cmp(a)(b)
export const at      = name => map => { … value(find(keyCmp(name))(map).first) … }
export const setReplace = name => value => setReduceEntry(replace)([name, value])  // wraps btreeSet
export const remove  = name => btreeRemove(keyCmp(name))
export const entries = values
export const empty   = null
```

Both define a string-keyed comparator (`cmp(value)` vs `keyCmp`), delegate
find/set/remove/values to `btree`, and expose `empty = null`. `string_set` is
the `key === value` specialization of the keyed collection that `ordered_map`
generalizes with `[key, value]` entries.

### Proposed abstraction

A single keyed-B-tree-collection factory parameterized by the key extractor and
key comparator:

```ts
const keyedCollection = <K, V>(keyOf: (v: V) => K, keyCmp: (a: K) => (b: K) => Sign) => ({
    contains: (k: K) => /* find via keyCmp(k) ∘ keyOf */,
    find:     (k: K) => …,
    set:      (v: V) => btreeSet(cmpBy(keyOf, keyCmp)(keyOf(v)))(…),
    remove:   (k: K) => btreeRemove(…),
    values,
    empty: null,
})
```

- `string_set` = `keyedCollection<string, string>(identity, stringCmp)`
- `ordered_map<T>` = `keyedCollection<string, Entry<T>>(fst, stringCmp)` plus
  its `setReduce`/`setReplace`/`at` value-layer conveniences on top.

Both consumers already exist: `ordered_map` is used widely (`object`,
`json/parser`, `djs/parser`, `bnf/data`, `js/tokenizer`); `string_set` is used
by `bnf/data`. So extracting now satisfies the second-consumer rule.

### Caveats / why this is an idea, not a mechanical edit

- **Value asymmetry.** A set has no value; a map's value participates in
  `setReduce` (combining on collision). The factory must either expose the raw
  `btreeSet(cmp)(update)` and let each wrapper decide the update function, or
  model the set as `OrderedMap<null>` and re-expose a value-free surface. The
  former keeps `string_set`'s storage compact (the value *is* the key, no
  `[k, v]` tuple); the latter is simpler but doubles `string_set`'s storage.
  This is a design call worth deciding before implementing.
- Keep `ordered_map`'s `setReduce`/`setReplace`/`at`/`fromEntries` as a thin
  value-layer over the shared core rather than pushing them into the factory.

The mechanical win is modest; the value is architectural — making explicit that
"set" and "ordered map" are one structure, so future ordered collections (e.g.
an ordered multiset) reuse the core instead of forking a third wrapper.

### Related

- [i37](../../issues/README.md) — language-level `Map`/reference containers; a unified
  keyed-collection core informs that direction.

---


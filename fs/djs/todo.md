# TODO

## DJS

**Priority:** P3
**Status:** open

Parse this code

```js
import a from 'c.f.js'
const c = [12, 'x']
export default { a: a, b: a, c: c}
```

Into this structure:

```ts
type Module = {
  modules: string[]
  func: Func
}

// the last constant from the array is a return
type Func = Const[]

type Const = Primitive | CObject | CArray |CRef | ARef

type Primitive = number|string|boolean|null|bigint

type CRef = ['cref', number]

type ARef = ['aref', number]

type CObject = ['object', {
  [k in string]: Const
}]

type CArray = ['array', [Const]]
```

Where `func` is a description of the function:

```js
(...args) => {
  const const0 = [12, 'x']
  return { a: args[0], b: args[0], c: const0}
}
```

### Parsed Example

```js
export default
// array of constants
[
  // const const0
  ['array', [12, 'x']],
  // return
  ['object', { 'a': ['aref', 0], 'b': ['aref', 0], c: ['cref', 0] }]
]
```

---

## 157. JSON/DJS: extract the shared value-machine core

**Priority:** P3
**Status:** open

DJS is a superset of JSON: every JSON value is a DJS value, plus DJS adds
`bigint`, `undefined`, identifier keys, const references, and module
(`import`/`const`/`export default`) framing. Because of that relationship the
two stacks should share their value-level machinery. Today they don't — three
separate pairs of modules each fork the same JSON value algorithm and then add
the small DJS delta on top.

The shared lexical engine (`fs/js/tokenizer/module.f.ts`) is already factored
correctly: both tokenizers delegate all character classification, escape
decoding, and number parsing to it. The duplication is one level up, in the
**value** layer: parser, serializer, and the tokenizer's minus-rewriter.

This issue tracks all three because they share one root cause; each part can be
landed independently.

### 1. Parser value-state machine (strongest)

`fs/json/parser/module.f.ts` and `fs/djs/parser/module.f.ts` implement the
*same* container-building state machine. The value-state alphabet is identical:

```ts
// json/parser/module.f.ts:32
status: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
// djs/parser/module.f.ts:73
valueState: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
```

and so is the helper set, structurally line-for-line:

| Helper | json/parser | djs/parser |
|---|---|---|
| `addKeyToObject` / `addValueToObject` / `addToArray` | 52–62 | 242–252 |
| `pushKey` / `pushValue` | 64–77 | 254–274 |
| `startArray` / `endArray` / `startObject` / `endObject` | 79–111 | 285–324 |
| `tokenToValue` | 113–124 | 326–339 |
| `isValueToken` | 126–137 | 341–354 |
| `parseValueOp` … `parseObjectCommaOp` | 139–201 | 356–497 |
| value-state dispatch in `foldOp` | 209–221 | 516–527 |

The differences are exactly the additive deltas DRY targets:

- DJS's `isValueToken` / `tokenToValue` add `bigint` and `undefined`.
- DJS accepts `'id'` as an object key (identifier properties, [i77](./README.md))
  in `parseObjectStartOp` / `parseObjectCommaOp`.
- DJS threads `metadata` into every error for source positions.
- DJS supports `pushRef` for const references and builds `['array', …]` /
  `['object', …]` AST tuples instead of plain arrays/objects.

The JSON value grammar (push/start/end/dispatch over the 9-state alphabet) is
the same in both. A parameterized factory — e.g. `fs/js/value_parser/module.f.ts`
— would take a small config record:

```ts
type ValueParser<Token, Value, Container> = {
    readonly isValueToken: (t: Token) => boolean
    readonly tokenToValue: (t: Token) => Value
    readonly array: { empty: Container, push: (c, v) => Container, build: c => Value }
    readonly object: { empty: Container, key: (c, k) => Container, push: (c, v) => Container, build: c => Value }
    readonly onError: (state, token) => State          // metadata vs no-metadata
    readonly extraKey?: (t: Token) => string | null    // id-as-key
    readonly extraValue?: (t: Token, state) => State | null  // refs
}
```

JSON instantiates it with plain JS containers and no metadata; DJS instantiates
it with AST-tuple containers, metadata-carrying errors, and the id/ref hooks,
then wraps the result in its module-level (`import`/`const`/`export`) machine,
which stays DJS-specific.

### 2. Recursive serializer walker (three copies)

The same recursive `typeof`-dispatch walker is written three times:

- `fs/json/module.f.ts:49` (`serialize`)
- `fs/djs/serializer/module.f.ts:79` (`serializeWithoutConst`)
- `fs/djs/serializer/module.f.ts:117` (`serializeWithConst`)

Each defines the identical closure cluster: `propertySerialize`
(`flat([stringSerialize(k), colon, f(v)])`), `mapPropertySerialize`,
`objectSerialize = fn(entries).map(sort).map(mapPropertySerialize).map(objectWrap).result`,
the recursive `f` switching on `typeof`, and
`arraySerialize = compose(map(f))(arrayWrap)`. The serializer already imports
its primitives (`stringSerialize`, `objectWrap`, `arrayWrap`, …) from
`fs/json/serializer/module.f.ts`, so the leaves are shared; only the walker was
copied.

The deltas:

- JSON's `f` handles `boolean | number | string | null | Array | Object`;
  DJS adds `bigint` and `undefined`.
- `serializeWithConst` is `serializeWithoutConst` plus a 6-line ref-counter
  short-circuit prepended to `f` (`djs/serializer/module.f.ts:138–143`).

**Sub-task 2b (clearest, smallest):** the two DJS functions collapse into one
factory taking an optional ref-lookup callback — when absent, the const
short-circuit is skipped and you get `serializeWithoutConst`. This removes ~40
duplicated lines inside one file with no cross-module coordination.

A `serializeValue` factory (in `json/serializer`) parameterized by the extra
`typeof` cases and an optional pre-`f` hook covers all three call sites.

### 3. Tokenizer minus-rewriter

`fs/json/tokenizer/module.f.ts:27–101` and `fs/djs/tokenizer/module.f.ts:26–116`
both wrap `js/tokenizer` and run the same two-state (`'def' | '-'`) `stateScan`
that folds a leading `-` into the following number token:

```ts
// json:73
case 'number': return [[{ kind: 'number', bf: multiply(input.token.bf)(-1n), value: `-${input.token.value}` }], { kind: 'def'}]
// djs:81
case 'number': return [[{ kind: 'number', bf: multiply(input.bf)(-1n), value: `-${input.value}` }], { kind: 'def'}]
```

Both define a matching `ScanState`, a `mapToken` allow-list, `parseDefaultState`,
`parseMinusState`, and a `scanToken` state dispatch. DJS additionally negates
`bigint` (line 80) and threads metadata; JSON drops `ws`/`nl` in `mapToken`
while DJS keeps them. A `negateOnMinus` scan factory parameterized by the token
allow-list and an optional bigint case removes the duplication.

> `fs/djs/tokenizer-new/module.f.ts` is a separate, BNF-grammar-based
> experiment (`todo()`-stubbed) and is **not** part of this duplication.

### Notes

- Only extract once both consumers exist — they do here (JSON and DJS are both
  shipping). This satisfies the "second real consumer" rule in `AGENTS.md`.
- Watch the existing DJS serializer's in-place mutation of `Refs`
  (`addRef`/`getConstantSelf` call `refs.set(...)` and assign `refCounter[2]`),
  which already violates the no-mutation convention; the extraction is a good
  moment to thread an immutable accumulator instead.

### Related

- [i003](todo.md) — DJS design and its relationship to JSON. The old
  `.d.js` extension conflict has been resolved and cleaned up.
- [i77](./README.md) — identifier property names, the DJS object-key delta.

---

## 196. `djs/parser`: collapse the trivia + eof/default handler boilerplate

**Priority:** P3
**Status:** open

### Problem

`fs/djs/parser/module.f.ts` defines 17 token-kind handlers
(`parseInitialOp`, `parseNewLineRequiredOp`, `parseExportOp`,
`parseResultOp`, `parseConstOp`, `parseConstNameOp`, `parseImportOp`,
`parseImportNameOp`, `parseImportFromOp`, `parseValueOp`,
`parseArrayStartOp`, `parseArrayValueOp`, `parseObjectStartOp`,
`parseObjectKeyOp`, `parseObjectColonOp`, `parseObjectNextOp`,
`parseObjectCommaOp`). Almost every one of them re-spells three
near-identical clauses:

```ts
case 'ws':
case 'nl':
case '//':
case '/*': return state                     // skip trivia
case 'eof': return { state: 'error', error: { message: 'unexpected end',   metadata } }
default:    return { state: 'error', error: { message: 'unexpected token', metadata } }
```

Counts in the file today:

- `case 'ws':` / `case 'nl':` / `case '//':` / `case '/*':` — **69** instances
  (≈ 17 × 4 cases, modulo a handful of variants where `'nl'` participates
  in the grammar rather than being trivia).
- `message: 'unexpected end'` / `message: 'unexpected token'` — **33**
  instances of the two boilerplate error returns.

The DJS tokenizer keeps `ws`/`nl`/`//`/`/*` in the stream on purpose
(it threads metadata, so trivia tokens carry positions). The parser
then has to skip them at every state. That skipping is the same
operation everywhere, but each handler hand-rolls it.

`fs/json/parser/module.f.ts` does **not** have this problem: its
tokenizer drops `ws`/`nl` upstream (`mapToken` returns `empty` for
them), and there are no `//` / `/*` tokens in JSON at all. So this is
strictly a DJS-side concern and orthogonal to
[i157](todo.md), which extracts the *value-level*
state machine shared with JSON.

### Proposed abstraction

A single trivia-aware wrapper that takes a "core" handler over the
non-trivia, non-eof tokens, and decorates it with the three boilerplate
branches:

```ts
// fs/djs/parser/module.f.ts (private)
type CoreHandler<S> = (token: DjsToken, metadata: TokenMetadata, state: S) => ParserState

const wrap =
    <S extends { readonly state: ParserState['state'] }>
    (core: CoreHandler<S>) =>
    ({ token, metadata }: DjsTokenWithMetadata) => (state: S): ParserState => {
        switch (token.kind) {
            case 'ws':
            case 'nl':
            case '//':
            case '/*': return state
            case 'eof':
                return { state: 'error', error: { message: 'unexpected end', metadata } }
            default:
                return core(token, metadata, state)
        }
    }

const unexpectedToken = (metadata: TokenMetadata): ParserState =>
    ({ state: 'error', error: { message: 'unexpected token', metadata } })
```

Each handler then collapses to its grammar-relevant cases plus an
explicit `default: return unexpectedToken(metadata)`:

```ts
const parseConstOp = wrap<ConstState>((token, metadata, state) => {
    if (token.kind === 'id') {
        if (at(token.value)(state.module.refs) !== null) {
            return { state: 'error', error: { message: 'duplicate id', metadata } }
        }
        const cref: AstModuleRef = ['cref', length(state.module.consts)]
        return { ...state, state: 'const+name', module: {
            ...state.module, refs: setReplace(token.value)(cref)(state.module.refs)
        } }
    }
    return unexpectedToken(metadata)
})
```

Three handlers diverge from the default trivia rule and need to opt
out of the wrapper (or use a small variant):

- `parseNewLineRequiredOp` — `'nl'` is **not** trivia here; it
  transitions `state: 'nl' → state: ''`. Keep this handler hand-written.
- `parseResultOp` — `'eof'` is **not** an error; it terminates
  acceptance. Keep this handler hand-written (or extend `wrap` with an
  `onEof` parameter).
- The value-level `'eof'` handlers (`parseValueOp`, `parseArrayStartOp`,
  `parseArrayValueOp`, `parseObjectStartOp`, `parseObjectKeyOp`,
  `parseObjectColonOp`, `parseObjectNextOp`, `parseObjectCommaOp`) all
  fold into i157's value-parser factory anyway; this issue covers the
  10 module-level handlers (`parseInitialOp`, `parseExportOp`,
  `parseConstOp`, `parseConstNameOp`, `parseImportOp`,
  `parseImportNameOp`, `parseImportFromOp`, plus any value-level ones
  not absorbed by i157).

### Why this qualifies

- DRY: 17 consumers in a single file, far past the second-consumer
  bar. The trivia + eof + default-error trio is one concept (token-stream
  preamble), not three separate switch arms repeated everywhere.
- Separation of concerns: skipping comments/whitespace is a
  tokenizer-vs-parser detail; today the parser bakes that knowledge into
  every state. Lifting it into one wrapper isolates the "DJS allows
  comments and whitespace anywhere" rule to one location.
- Readability: each handler's grammar-relevant lines shrink to the
  cases that actually matter for that state. Today the grammar is buried
  under boilerplate.
- Maintainability: if a new trivia token is added (e.g. `'#'`
  comments from [i83](./README.md)), there is one place to update,
  not 17.

### Caveats / why this is an idea, not a mechanical edit

- **i157 dependency.** The value-level handlers
  (`parseValueOp`/`parseArrayStartOp`/…) should be extracted via
  [i157](todo.md) first. After that, the trivia
  wrapper covers only the DJS module-framing handlers (≈ 10 sites)
  rather than 17. Either order works; the result is the same end state.
- **The `'nl'` exception.** `parseNewLineRequiredOp` deliberately treats
  `'nl'` as *the* significant token, not trivia. Don't fold it into
  `wrap` without explicit opt-out (e.g. a flag, or a different wrapper).
- **`ParserState` shape.** The wrapper returns `ParserState` (the union
  of all state-kind branches), so the type system can't statically
  enforce that the core handler returns "same-state-kind only" — it can
  legitimately transition to a different state. Today's handlers already
  exploit this freely (e.g. `parseInitialOp` transitions to `'import'`,
  `'const'`, `'export'`, or `'exportValue'`), so the wrapper signature
  must accept `ParserState` returns.
- **Don't over-abstract.** A `wrap` with five different opt-out flags is
  worse than the current code. If more than ~2 handlers need to escape
  the default, keep those few hand-written instead of growing the
  wrapper's API surface.

### Related

- [i157](todo.md) — extracting the JSON value-state
  machine shared with DJS. Reduces the 17 handlers to ~10 before this
  refactor is applied.
- [i83](./README.md) — `#` comments. A successful extraction here makes
  that change a one-line edit to the wrapper's trivia case list.
- [i165](../bnf/todo.md) — a layered tokenizer/parser design
  that, if adopted, would push trivia handling entirely into the
  tokenizer layer and obviate this issue. This proposal targets the
  current architecture.

---

## 197. `djs`: extract the `Unknown`-shape walker (5 consumers)

**Priority:** P3
**Status:** open
**Blocked by:** [i157](todo.md)

### Problem

The DJS `Unknown` value shape

```ts
// fs/djs/module.f.ts:25
type Primitive = JsonPrimitive | bigint | undefined
type Unknown   = Primitive | Object | Array
```

is currently traversed by **five independent** `typeof`-dispatch
walkers, each re-spelling the same nine branches (`boolean`, `number`,
`string`, `bigint`, `null`, `undefined`, `Array`, `Object`, and either
recursion or terminal handling):

| # | Location | Purpose |
|---|---|---|
| 1 | `fs/json/module.f.ts:67` — `serialize.f` | JSON `typeof` switch (a subset: no `bigint` / `undefined`). |
| 2 | `fs/djs/serializer/module.f.ts:99` — `serializeWithoutConst.f` | DJS serialize (+`bigint` +`undefined`). |
| 3 | `fs/djs/serializer/module.f.ts:135` — `serializeWithConst.f` | (2) + ref-counter short-circuit. |
| 4 | `fs/djs/serializer/module.f.ts:36` — `getConstantsOp` | Collect constants for `const c{n} = …` block. |
| 5 | `fs/djs/serializer/module.f.ts:163` — `countRefsOp` | Count references for the ref table. |
| 6 | `fs/djs/ast/module.f.ts:50` — `toDjs` | Evaluate `AstConst` → `Unknown` (over `AstConst`, a parallel shape with `'aref'`/`'cref'`/`'array'` tuples). |

[i157 §2](todo.md) covers (1)–(3) by factoring the
serializer walker. This issue extends that coverage to **(4)** and
**(5)** in the same serializer file, and observes that **(6)** is the
same shape walk under a different name and could share machinery if the
common visitor is generic enough.

### The recurring skeleton

Every walker is a `Visitor`-style dispatch:

```ts
const walk = (v: Unknown): R => {
    switch (typeof v) {
        case 'boolean': return /* leaf */
        case 'number':  return /* leaf */
        case 'string':  return /* leaf */
        case 'bigint':  return /* leaf, DJS-only */
        default: {
            if (v === null)       return /* leaf */
            if (v === undefined)  return /* leaf, DJS-only */
            if (v instanceof Array) return /* recurse */
            return /* recurse over entries */
        }
    }
}
```

The five walkers vary only in:

- **What they return / accumulate** (`R`): a `List<string>` of source
  fragments, a `Refs` map, a `GetConstsState`, or the value itself.
- **The leaf actions** (e.g. JSON `serialize` ignores `bigint` because
  it can't appear; the const counter records strings/bigints but not
  booleans).
- **Whether containers recurse into entries-then-self, self-then-entries,
  or self-only**: the serializers recurse into children, the const
  counter records both self and children, and `getConstantsOp` shorts
  the recursion when a ref already exists.

This is exactly the variation that
`fs/types/rtti/common/module.f.ts:visit` was built for: it parametrises
schema traversal by a `Visitor<R>` with one handler per variant, and
both `validate` and `parse` plug in different visitors over the same
ADT. The same factoring applies here.

### Proposed abstraction

A `Visitor`-style walker for `Unknown`, e.g. in
`fs/djs/walk/module.f.ts`:

```ts
export type Visitor<R> = {
    readonly boolean:   (v: boolean)        => R
    readonly number:    (v: number)         => R
    readonly string:    (v: string)         => R
    readonly bigint:    (v: bigint)         => R
    readonly null_:     ()                  => R
    readonly undefined_: ()                 => R
    readonly array:    (v: Array,  recurse: (item: Unknown) => R) => R
    readonly object:   (v: Object, recurse: (item: Unknown) => R) => R
}

export const walk = <R>(v: Visitor<R>) => {
    const f = (value: Unknown): R => {
        switch (typeof value) {
            case 'boolean': return v.boolean(value)
            case 'number':  return v.number(value)
            case 'string':  return v.string(value)
            case 'bigint':  return v.bigint(value)
            default: {
                if (value === null)      return v.null_()
                if (value === undefined) return v.undefined_()
                if (value instanceof Array) return v.array(value, f)
                return v.object(value, f)
            }
        }
    }
    return f
}
```

The container handlers receive the recursive `f` as their second
argument so the walker doesn't pre-commit to a recursion order or
strategy. Each consumer chooses:

- **Serialize** → recurse into children, concat the bytes.
- **`countRefsOp`** → record `self`, then recurse into children (so
  containers refs are counted before their elements).
- **`getConstantsOp`** → recurse into children first, then record
  `self` (post-order — children are emitted as consts before the parent
  is).
- **`serializeWithConst`** → check the refs map; if `value !== root`
  and `refs.get(value)[1] > 1`, return the `c{n}` short-circuit;
  otherwise fall through to the default walk.

JSON's `serialize` is a strict subset: its visitor's `bigint` and
`undefined_` handlers can either be `undefined` (and the walker's
dispatch typed accordingly) or `() => { throw 'unreachable' }` (clean
TypeScript, runtime assertion). The cleaner path is to expose a
`JsonVisitor<R> = Omit<Visitor<R>, 'bigint' | 'undefined_'>` and a
`walkJson` over `JsonValue = JsonPrimitive | JsonObject | JsonArray`,
sharing the four common leaves through a base visitor.

### Why this qualifies

- DRY: **5 consumers** in DJS alone, plus the JSON serializer. Every
  walker today re-encodes the union shape; if a new variant is added
  (e.g. `symbol`, `Date`), every walker has to be updated.
- Separation of concerns: "what's the variant of this `Unknown`
  value" is one question; today five sites each ask it separately.
- Builds on a proven pattern: `rtti/common/visit` already does this for
  the RTTI `Type` ADT. A `walk` for the DJS value ADT is the natural
  counterpart — same shape, same value.
- Composes with i157: i157 §2 factors three of the serializer walkers
  into a single factory. This issue extends that factoring to the
  remaining two ref-bookkeeping walkers and the `toDjs` evaluator,
  collapsing all six onto one shared visitor.

### Caveats

- **`toDjs` is over `AstConst`, not `Unknown`.** It has an extra
  `Array`-branch sub-discriminator (`'aref' | 'cref' | 'array'`). A
  unified `walk` would need either a generic `array` handler that
  inspects the tuple shape itself, or a separate `walkAst` whose `array`
  handler decides between resolving a ref and recursing into a literal.
  Both are reasonable; pick the one with less type plumbing.
- **The const short-circuit in `serializeWithConst`** runs *before* the
  typeof dispatch, not within it. The visitor abstraction supports this
  via a `pre`-hook (a wrapper around `walk`), but adding `pre` to the
  visitor API is a real surface-area cost — only do it if it pays off
  across two or more consumers. Today only `serializeWithConst` needs
  it.
- **Land i157 first.** The serializer factoring in i157 should be done
  before this one — i157 collapses three of the five DJS walkers into
  one factory, and *that* factory is the natural client of the
  `Visitor` extracted here. Doing both at once risks landing the
  visitor without the factory and then having to refactor the visitor
  later.
- **Don't preemptively unify with `rtti/common/visit`.** RTTI's `visit`
  is over schema descriptors (`Type`), not values (`Unknown`). The
  visitor types are isomorphic in shape but semantically distinct;
  collapsing them is an [i172](../types/todo.md)-
  style speculative move and should wait for a third real consumer.

### Related

- [i157 §2](todo.md) — the serializer walker
  factoring. This issue is its natural follow-up: same idea, two
  additional call sites.
- [i172](../types/todo.md) — a similar
  "merge parallel container factories" idea on the RTTI side. The
  pattern here is the same shape; the conclusions about when to
  defer apply equally.
- [i143](../types/todo.md) — RTTI data form may introduce a third
  RTTI consumer, which is what would unblock i172 and validate this
  pattern across the codebase.

---

## 663-json-djs-tree-type. One generic recursive value shape for `json`/`djs`/serializer

**Priority:** P4
**Status:** open

### Problem

The recursive "JSON-like tree" container shape — *an object whose values are
trees, an array of trees, or a leaf* — is spelled out **three times** in the
codebase. The three copies have the **identical container structure** and differ
only in which leaf (`Primitive`) types are allowed:

```ts
// fs/json/module.f.ts:16
type Object = { readonly [k in string]: Unknown }
type Array = readonly Unknown[]
export type Primitive = boolean | string | number | null
export type Unknown = Primitive | Object | Array
```

```ts
// fs/djs/module.f.ts:19
export type Object = { readonly [k in string]: Unknown }
export type Array = readonly Unknown[]
export type Primitive = JsonPrimitive | bigint | undefined   // JsonPrimitive imported from json
export type Unknown = Primitive | Object | Array
```

```ts
// fs/json/serializer/module.f.ts:10
type Obj<T> = { readonly [k in string]: Unknown<T> }
type Arr<T> = readonly Unknown<T>[]
type Primitive = boolean | string | number | null           // ← unused (see below)
type Unknown<T> = Arr<T> | Obj<T> | null | T
```

The container half — `{ [k]: tree }`, `readonly tree[]`, and the
`leaf | object | array` union — is byte-for-byte the same idea in all three.
The only axis of real variation is the leaf set:

| Module | Leaf set (`Primitive`) |
|---|---|
| `fs/json/module.f.ts` | `boolean \| string \| number \| null` |
| `fs/djs/module.f.ts` | json's `+ bigint \| undefined` |
| `fs/json/serializer/module.f.ts` | generic `T` (with `null` baked in) |

Two further observations sharpen the case:

1. **The serializer already invented the generic form.** Its `Unknown<T>`
   (`serializer/module.f.ts:22`) is exactly "the json/djs tree, parameterized
   over the leaf type." It exists so the one serializer can stringify both json
   values and djs values. But it lives **privately inside the serializer**, so
   the two public modules (`json`, `djs`) can't name it and re-declare the shape
   by hand instead.

2. **`djs` already declares its leaf set as an extension of json's.** It imports
   `Primitive as JsonPrimitive` (`djs/module.f.ts:6`) and writes
   `JsonPrimitive | bigint | undefined`. So the "json ⊂ djs" relationship is
   half-expressed at the leaf level but thrown away at the container level,
   where `Object`/`Array`/`Unknown` are copy-pasted rather than reused.

3. **The serializer's local `Primitive` (`serializer/module.f.ts:16`) is dead.**
   `Unknown<T>` never references it — it bakes `null` in directly and takes the
   rest of the leaf set as `T`. `grep -n Primitive fs/json/serializer/module.f.ts`
   finds only the declaration. It's a leftover copy of json's leaf set with no
   consumer (companion to the i65Y-dead-code-cleanup
   theme).

### Proposal

Define the recursive container **once**, parameterized over the leaf type, and
make `json` and `djs` two instantiations. Home: a small shared module
`fs/json/common/module.f.ts`, since both `json` and `djs` already sit on the
json leaf set.

**Naming (per review on PR #928).** Keep the names the modules already use —
`Unknown<P>`, `Object<P>`, `Array<P>` — in the common module, and let consumers
pull them in under a namespace alias so the call sites read `Tree.Unknown<P>`,
`Tree.Object<P>`, `Tree.Array<P>`. This keeps each name consistent with its
existing role and avoids minting new bespoke identifiers:

```ts
// fs/json/common/module.f.ts
/** A recursive JSON-shaped tree over a leaf/primitive type `P`. */
export type Unknown<P> = P | Object<P> | Array<P>
export type Object<P> = { readonly [k in string]: Unknown<P> }
export type Array<P> = readonly Unknown<P>[]
```

```ts
// fs/json/module.f.ts
import type * as Tree from './common/module.f.ts'
export type Primitive = boolean | string | number | null
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>   // keep named alias for current importers
export type Array = Tree.Array<Primitive>
```

```ts
// fs/djs/module.f.ts
import type * as Tree from '../json/common/module.f.ts'
import type { Primitive as JsonPrimitive } from '../json/module.f.ts'
export type Primitive = JsonPrimitive | bigint | undefined
export type Unknown = Tree.Unknown<Primitive>
export type Object = Tree.Object<Primitive>
export type Array = Tree.Array<Primitive>
```

```ts
// fs/json/serializer/module.f.ts
// delete the local Obj<T>/Arr<T>/Primitive/Unknown<T> block; use the namespace instead.
import type * as Tree from '../common/module.f.ts'
// every `Unknown<T>` site becomes `Tree.Unknown<T>` (T includes/excludes null per caller)
```

> **Alternative naming.** If a namespace import is undesirable at some call
> site, the flat form `TreeUnknown<P>` / `TreeObject<P>` / `TreeArray<P>`
> (a single `Tree`-prefixed trio) is equivalent and keeps the union name
> consistent with its `TreeObject`/`TreeArray` siblings.

This is a **type-only** change — zero runtime impact, no `.f.ts` value exports
move — yet it collapses three hand-written copies of the same recursive shape
into one generic, deletes one dead local type, and makes the `json ⊂ djs`
relationship explicit at the container level instead of only the leaf level.

### Why this qualifies

- **DRY at the right altitude.** The container recursion is one concept with two
  real consumers today (`json`, `djs`) plus the serializer's already-generic
  third copy — well past the "second real consumer" bar `AGENTS.md` sets for
  extraction. We are not inventing a generic for a single hypothetical caller;
  we are unifying three existing copies.
- **Separation of concerns.** "What a JSON/DJS *value* is" is a data-shape
  concern that should have one home, distinct from "how to parse it"
  ([i157](todo.md)) and "how to walk/serialize it"
  ([i197](todo.md)). Today the shape is co-located with, and
  duplicated across, the modules that consume it.
- **Removes a divergence hazard.** As long as three copies exist, a fix to the
  container (say, tightening object keys, or a `readonly` change) has to be made
  in three places or the shapes silently drift. One generic makes drift
  impossible.

### Caveats / why this is a proposal, not a mechanical edit

- **Keep the named `Object`/`Array` aliases.** Real importers depend on the
  member names, not just `Unknown`: `fs/djs/serializer/module.f.ts:6` imports
  `Object` from `djs`, and the rtti family imports `Unknown`/`Primitive` from
  `djs` (`types/rtti/{validate,parse,ts,common}/module.f.ts`,
  `types/rtti/module.f.ts:40`). The generic must therefore ship with
  `Tree.Object<P>`/`Tree.Array<P>` so each module can re-expose `Object`/`Array`
  under their current names. Re-exposing only the `Unknown` union would break
  those imports.
- **Recursive generic type aliases.** TypeScript supports recursive generic
  aliases like `Tree.Unknown<P>` fine, but confirm `tsc` (and `deno`'s slow-types check,
  i147) accept the three-alias form without an
  explicit annotation cycle error before landing. The current non-generic
  `Unknown` is itself recursive, so this is expected to be a non-issue — verify
  rather than assume.
- **`null` placement in the serializer's `T`.** The serializer writes
  `Unknown<T> = Arr<T> | Obj<T> | null | T` — `null` is outside `T`. For
  `json`/`djs` the leaf set already contains `null`, so instantiating
  `Tree.Unknown<Primitive>` (where `Primitive ∋ null`) is correct; just make
  sure the serializer's call sites pass a leaf type that already includes `null`
  (or that the common definition folds `null` in consistently) so the migration
  doesn't quietly add/drop `null` from any position.
- **Decide the home, don't over-engineer it.** A new `fs/json/common/` module is
  the obvious fit (json owns the base leaf set; djs already imports from json).
  Don't promote this to `fs/types/` "just in case" — there is no consumer
  outside the json/djs family.
- **Module-header JSDoc + `deno.json`.** If a new `module.f.ts` is created, add
  the standard `@module` header and register it in the `exports` map of
  `deno.json`, per `AGENTS.md`.

### Related

- [i157](todo.md) — shares the json/djs *parser* value
  machine. Complementary: that issue unifies the runtime that builds these
  trees; this one unifies the type that describes them. A shared `Tree<P>` gives
  i157's factored machine a single typed target.
- [i197](todo.md) — extracts the `Unknown`-shape *walker*
  (5 consumers). It quotes these very type definitions as context but proposes
  deduplicating the *traversal functions*, not the *types*. Landing this first
  gives that walker one generic shape to be written against.
- i65Y-dead-code-cleanup — same spirit; the unused
  `Primitive` in `json/serializer/module.f.ts:16` can be removed here or there.

- `fs/json/module.f.ts:16,20,22,24` — copy 1 (json leaf set).
- `fs/djs/module.f.ts:19,23,25,27` — copy 2 (djs leaf set).
- `fs/json/serializer/module.f.ts:10,14,16,22` — copy 3 (generic, private; line 16 dead).

---

## 66E-parser-container-stack-bookkeeping. JSON/DJS parser: separate container-stack bookkeeping from container kind

**Priority:** P4
**Status:** open

### Problem

Both `fs/json/parser/module.f.ts` and `fs/djs/parser/module.f.ts` build the
container state machine out of four helpers — `startArray`, `startObject`,
`endArray`, `endObject` — and within each module the two `start*` helpers and
the two `end*` helpers share their *entire* stack-bookkeeping body. The only
thing that genuinely differs between array and object is the container kind: the
`status` label and the empty-container literal on the way in, and how the
finished container's value is extracted on the way out. Everything around that —
pushing the current `top` onto the stack, popping it back off, and threading the
result through `pushValue` — is repeated verbatim.

#### JSON (`fs/json/parser/module.f.ts:79-111`)

The stack-push line is byte-identical in both `start*` helpers:

```ts
const startArray
    : (state: StateParse) => JsonState
    = state => {
        const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
        return { status: '[', top: { kind: 'array', values: null }, stack: newStack }
    }

const startObject
    : (state: StateParse) => JsonState
    = state => {
        const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
        return { status: '{', top: { kind: 'object', values: null, key: '' }, stack: newStack }
    }
```

and the pop-and-push-result body is identical in both `end*` helpers — only the
expression that turns `state.top` into a finished value changes:

```ts
const endArray
    : (state: StateParse) => JsonState
    = state => {
        const array = state.top !== null ? toArray(state.top.values) : null
        const newState
            : StateParse
            = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
        return pushValue(newState)(array)
    }

const endObject
    : (state: StateParse) => JsonState
    = state => {
        const obj = state.top?.kind === 'object' ? fromMap(state.top.values) : null
        const newState
            : StateParse
            = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
        return pushValue(newState)(obj)
    }
```

#### DJS (`fs/djs/parser/module.f.ts:283-322`)

The same shape recurs, with `{ ...state, ... }` spread instead of a fresh record
and tuple containers instead of `kind`-tagged objects:

```ts
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ... state, valueState: '[', top: ['array', null ], stack: newStack }
}
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ... state, valueState: '{', top: ['object', null, ''], stack: newStack }
}

const endArray = state => {
    const top = state.top;
    const newState = { ... state, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    if (top !== null && top[0] === 'array') {
        const array: AstArray = ['array', toArray(top[1])];
        return pushValue(newState)(array)
    }
    return pushValue(newState)(null)
}
const endObject = state => {
    const obj = state?.top !== null && state?.top[0] === 'object' ? fromMap(state.top[1]) : null;
    const newState = { ... state, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(obj)
}
```

So the `newStack` push appears **four** times across the two modules and
`newState` pop appears **four** times, each one a verbatim copy of its sibling.
The repeated lines are not trivial one-liners: the push is a conditional
(`state.top === null ? null : { first, tail }`) and the pop combines
`first(null)(state.stack)` with `drop(1)(state.stack)` and resets the status.
This is exactly the case `AGENTS.md` calls out — "when two code branches share
most of their structure, refactor so the shared part appears once and only the
difference lives in the conditional" — and it is also a separation-of-concerns
point: *manipulating the container stack* is a distinct concern from *which
container kind* is being opened or closed.

The DRY trigger is already met inside each module on its own: there are two real
consumers of the start skeleton (array, object) and two of the end skeleton, so
this is not a speculative one-call-site extraction.

### Proposal

In each parser, name the two stack operations once and parameterize the
container-kind difference. For JSON:

```ts
// stack bookkeeping — the concern shared by every container
const pushStack = (state: StateParse): JsonStack =>
    state.top === null ? null : { first: state.top, tail: state.stack }

const popState = (state: StateParse): StateParse =>
    ({ status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) })

// container-kind difference — the only thing each helper actually varies
const startContainer =
    (status: '[' | '{') => (top: JsonStackElement) => (state: StateParse): JsonState =>
        ({ status, top, stack: pushStack(state) })

const endContainer =
    (build: (top: JsonStackElement | null) => Unknown) => (state: StateParse): JsonState =>
        pushValue(popState(state))(build(state.top))

const startArray  = startContainer('[')({ kind: 'array', values: null })
const startObject = startContainer('{')({ kind: 'object', values: null, key: '' })
const endArray  = endContainer(top => top !== null ? toArray(top.values) : null)
const endObject = endContainer(top => top?.kind === 'object' ? fromMap(top.values) : null)
```

The empty-container literal is now evaluated once at module load and shared
across calls (sound, since the values are immutable), and the stack push/pop
lives in exactly one place. The four public helpers shrink to one-line
derivations whose body *is* the array-vs-object difference and nothing else.

The DJS module gets the same treatment, keeping its `{ ...state, ... }` spread
inside `startContainer` / `popState` and its tuple containers / `['array', …]`
result in the `build` callbacks. `endArray`'s "top is not actually an array →
push `null`" fallback stays inside its `build` callback, so the shared
`pushValue(popState(state))(...)` skeleton is unchanged.

### Why this is filed at P4

The individual helpers are readable as they stand, so this is a cleanup, not a
correctness fix — hence not high priority. It is worth doing when either parser
is next touched, and it is a natural prerequisite for
[i157-json-djs-shared-core](todo.md): that issue wants to
*share one value-machine across json and djs*, and the cleaner the per-module
start/end building blocks are first, the smaller the surface that shared core has
to absorb. The two efforts are complementary, not overlapping — 157 removes
duplication **between** the two parsers; this removes duplication **within** each
one and can land independently of 157.

### Tasks

- [ ] In `fs/json/parser/module.f.ts`, add `pushStack` / `popState` (or
      equivalently named) and `startContainer` / `endContainer`; derive
      `startArray` / `startObject` / `endArray` / `endObject` from them.
- [ ] Apply the same shape to `fs/djs/parser/module.f.ts`, preserving the
      `{ ...state }` spread and the `endArray` non-array fallback inside the
      `build` callback.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/json/parser/proof.f.ts` and
      `fs/djs/parser/proof.f.ts` still pass with full line/branch coverage
      (behaviour is unchanged — this is a pure refactor).

### Related

- [i157-json-djs-shared-core](todo.md) — the larger effort
  to share one value-machine across json and djs; this issue tidies the per-module
  start/end helpers it would build on.
- [i165-layered-parser](../bnf/todo.md) — adjacent parser-architecture
  cleanup.

---

## Incremental

**Priority:** P3
**Status:** open

### 1. JSON

```json
{
    "a": [5.3, false],
    "b": null
}
```

### 2. `export default`

```js
export default {
    "a": [5.3, false],
    "b": null
}
```

### 3. `import`, `const`, bigint, undefined and comments

Release: 0.6.9.

```js
// import
import a from "./a.f.js"
// const and bigint
const c = -24n
export default {
    /* properties: */
    "a": [5.3, false, c],
    "b": null,
    "c": undefined
}
```

### 4. Next

- identifier properties
- trailing comma

```js
// import
import a from "./a.f.js"
// const and bigint
const c = -24n
export default {
    /* properties: */
    "a": [5.3, false, c],
    "b": null,
    c: c, //< identifier properties and trailing comma
}
```

### 5. Wish List

```js
import a from "./a.f.js"
const c: bigint = -24n //< Type erasure
export default {
    1e3: c //< number properties.
    _: c, /*< identifiers as properties */
    "a": [5.3, false, c],
    "f1": x => { //< function with body
        return 7
    },
    "f2": x => {
        const m = () => x //< function with constants
        return m
    },
    "f3": () => c, //< functions w/o parameters
    "f4": a => b => [a, b], //< functions with parameters
    f11: m => ({ m: 5 }) //< function returns an object
    c, //< property that references a constant with the same name
    "b": null,
    'x': 'x', //< single quoted strings.
}
```

---


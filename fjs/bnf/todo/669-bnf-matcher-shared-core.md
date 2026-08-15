## 669-bnf-matcher-shared-core. One owner for the matcher cursor, AST, and result constructors

**Priority:** P3
**Status:** open

> Renamed from `669-bnf-data-shared-helpers.md`. That issue described the
> `mrSuccess` / `mrFail` pair as a `fjs/bnf/data` hoisting smell, quoting a
> code state that no longer exists: the backends have since moved into
> `fjs/bnf/ll1` and `fjs/bnf/descent`, both constructors build records rather
> than tuples, and neither is declared inside the matcher's `f` any more. The
> duplication it pointed at is real and has grown — it is now the smallest of
> three things the two backends each own a copy of. Item 3 below is the
> original issue, corrected.

### Problem

`fjs/bnf/ll1` and `fjs/bnf/descent` are two matchers over one contract.
[`fjs/bnf/README.md`](../README.md#logical-eof-in-parser-input) states that
contract normatively — callers supply physical symbols only, each backend
synthesizes exactly one logical EOF after them, public positions stay physical,
and internally a backend tracks the complete cursor `(idx, eofConsumed)`
because consuming EOF is progress even though `idx` does not move. Nothing owns
it in code. Each backend derives it separately, and since
[#1531](https://github.com/functionalscript/functionalscript/pull/1531) both
derive it *identically*, as the extended position `0 .. cp.length + 1`.

Three things are duplicated.

#### 1. The cursor and its accessors

```js
// fjs/bnf/descent/module.f.mjs          // fjs/bnf/ll1/module.f.mjs
/** @typedef {number} _Cursor */         /** @typedef {number} _Cursor */
const symbolAt = (cp, pos) =>            const symbolAt = (cp, pos) =>
    pos < cp.length ? cp[pos][0]             pos < cp.length ? cp[pos]
                    : eofSymbol                              : eofSymbol
const leafAt = (cp, pos) =>              const leafAt = (cp, pos) =>
    pos < cp.length ? [cp[pos]] : []         pos < cp.length ? [cp[pos]] : []
const physicalIdx = length => pos =>     const remainderAt = (cp, pos) => pos === null ? null
    Math.min(pos, length)                    : cp.slice(Math.min(pos, cp.length))
```

`leafAt` is the same function twice, already generic in the leaf type.
`symbolAt` differs only in how it reads a symbol out of a leaf — `cp[pos]`
against `cp[pos][0]`. `physicalIdx` is the clamp `remainderAt` slices at.

The prose is duplicated with the code: the same explanation of why
`cp.length + 1` is a position, and why consuming EOF counts as progress, now
appears in both modules and in the README. When one copy is corrected the
others silently drift — and this is a contract every future backend
([recognizer-backend](./recognizer-backend.md),
[new-parser](./new-parser.md)) must also implement.

#### 2. The AST shape

`ll1`'s `_AstRule` / `AstSequence` and `descent`'s `AstRuleMeta<T>` /
`AstSequenceMeta<T>` are one type family parameterized by leaf type: `ll1`'s
leaf is `CodePoint`, `descent`'s is `CodePointMeta<T>`. `AstTag` is declared
byte-identically in both `types.ts` files:

```ts
export type AstTag = string|true|undefined
```

#### 3. The result constructors

Both modules define the pair the original issue named, now record-shaped and at
module scope in `ll1` and inside `descentParser` in `descent`:

```js
const mrSuccess = (tag, sequence, pos) => ({ast: {tag, sequence}, success: true, pos})
const mrFail = (tag, sequence, pos) => ({ast: {tag, sequence}, success: false, pos})
```

They differ only in the leaf type and in `pos` — `_Cursor` in `descent`,
`_Cursor|null` in `ll1`, whose extra `null` is the "ran out of input" state
its public `Remainder` reports.

#### What must not be shared

The machines themselves. `descent` backtracks: two frame kinds, a per-frame
rewind to the sequence's start, and a furthest-failure high-water mark that
outlives the rewinds. `ll1` is predictive: one frame kind, and a cursor that
never moves backwards. Their public results are different types on purpose —
`{ ast, success, idx, failure? }` against `readonly [ast, success, Remainder]`.
One matcher covering both would be worse than two, and this issue does not
propose it.

### Proposal

A new `fjs/bnf/matcher/` owning the shared layer — the cursor, the AST it
builds, and the constructor that pairs them. One module rather than three: the
three are interdependent (`leafAt` produces AST leaves, `mr` builds AST nodes
positioned by a cursor), and splitting them would put one concept behind three
imports.

`fjs/bnf/matcher/types.ts`:

```ts
/** Tag of an AST node ... */
export type AstTag = string|true|undefined

/** An AST over leaves of type `L`. */
export type Ast<L> = {
    readonly tag: AstTag
    readonly sequence: AstSequence<L>
}

export type AstSequence<L> = readonly(Ast<L>|L)[]

/**
 * A match position over input of `length` leaves: `0 .. length` are the
 * physical positions, and `length + 1` is where the one synthesized EOF has
 * been consumed. <...the (idx, eofConsumed) explanation, once...>
 */
export type Cursor = number

/**
 * A matcher's own result: an AST, whether it matched, and where it stopped.
 * `P` is the position type — `Cursor` for a backend whose match always has
 * one, `Cursor|null` for one that also reports running out of input.
 */
export type AstResult<L, P> = {
    readonly ast: Ast<L>
    readonly success: boolean
    readonly pos: P
}
```

`fjs/bnf/matcher/module.f.mjs`:

```js
/** @type {<L>(input: readonly L[], pos: Cursor) => readonly L[]} */
export const leafAt = (input, pos) => pos < input.length ? [input[pos]] : []

/** @type {<L>(symbolOf: (leaf: L) => number) => (input: readonly L[], pos: Cursor) => number} */
export const symbolAt = symbolOf => (input, pos) =>
    pos < input.length ? symbolOf(input[pos]) : eofSymbol

/** @type {(length: number) => (pos: Cursor) => number} */
export const physicalIdx = length => pos => Math.min(pos, length)

/** @type {<L, P>(success: boolean) => (tag: AstTag, sequence: AstSequence<L>, pos: P) => AstResult<L, P>} */
const mr = success => (tag, sequence, pos) => ({ast: {tag, sequence}, success, pos})

export const mrSuccess = mr(true)
export const mrFail = mr(false)
```

`symbolOf` is the one place the two leaf shapes differ, so each backend binds
its partial application once at module scope, per
[fjs/AGENTS.md §3.3](../../AGENTS.md#place-curried-partial-applications-at-their-dependencys-scope):
`symbolAt(identity)` in `ll1` (`identity` from `fjs/types/function`) and
`symbolAt(([symbol]) => symbol)` in `descent`.

Call sites:

- `ll1`: `_AstRule` becomes `Ast<CodePoint>`, `AstSequence` becomes
  `AstSequence<CodePoint>`, `_Result` becomes
  `AstResult<CodePoint, _Position>`; `AstTag`, `symbolAt`, `leafAt`,
  `mrSuccess`, `mrFail` come from the shared module, and `remainderAt` keeps
  only the part that is genuinely `ll1`'s — `pos === null ? null :
  cp.slice(physicalIdx(cp.length)(pos))`.
- `descent`: `AstRuleMeta<T>` becomes `Ast<CodePointMeta<T>>`,
  `AstSequenceMeta<T>` becomes `AstSequence<CodePointMeta<T>>`, `_Result`
  becomes `AstResult<CodePointMeta<T>, _Cursor>`; `physicalIdx`, `symbolAt`,
  `leafAt`, and the constructors come from the shared module.
- Delete the `AstRuleMeta` / `AstSequenceMeta` / `AstTag` declarations rather
  than aliasing the new names to the old ones
  ([DESIGN.md §2](../../../DESIGN.md#2-the-api-is-the-most-important-part-of-quality):
  two spellings for one concept is the last resort, not the convenient path).
  There is exactly one external importer to update, `fjs/djs/tokenizer`, which
  takes `AstRuleMeta`, `AstSequenceMeta`, `AstTag`, and `CodePointMeta` from
  `descent/types.ts`. `CodePointMeta<T>` stays in `descent` — a leaf carrying
  metadata is that backend's own concept.

The README stops describing the cursor twice: `fjs/bnf/README.md` keeps the
normative statement, each backend's README keeps only what is true of *it*
(`ll1`: no backtracking, so the cursor never rewinds; `descent`: rewind and
the furthest-failure mark), and the shared JSDoc holds the mechanics.

### Optional, decide when implementing

Both machines now carry the same immutable cons-cell stack:

```js
/** @typedef {null | { readonly top: _Frame, readonly rest: _Stack }} _Stack */
```

It is a typedef with no functions — push and pop are object literals at the
use site — and its frame types have nothing in common, so sharing it buys one
line each. If it is shared, it is a general immutable stack and belongs in
`fjs/types`, not in `fjs/bnf`. Flagged, not proposed.

### Tasks

- [ ] Create `fjs/bnf/matcher/` (`types.ts`, `module.f.mjs`, `proof.f.mjs`,
      `README.md`) with the cursor, the AST family, and the result
      constructors.
- [ ] Convert `fjs/bnf/ll1` to the shared module; delete its copies.
- [ ] Convert `fjs/bnf/descent` to the shared module; delete its copies,
      including the `AstTag` declaration.
- [ ] Update `fjs/djs/tokenizer`'s imports to the new type names.
- [ ] Move the cursor prose: one normative statement in `fjs/bnf/README.md`,
      mechanics in the shared JSDoc, backend-specific facts in each backend's
      README.
- [ ] `npx tsc`, `fjs t`; both backends' proofs pass unchanged, and the new
      module ships 100% proof coverage.

### Related

- [terminal-range-shared-type](./terminal-range-shared-type.md) — the same
  one-owner move for `TerminalRange`, which `bnf` and `bnf/data` both declare.
- [665-bnf-data-fold-children](./665-bnf-data-fold-children.md) and
  [667-bnf-repeat-flatten](./667-bnf-repeat-flatten.md) — other `bnf/data`
  cleanups; different functions, and unaffected by this one.
- [recognizer-backend](./recognizer-backend.md),
  [new-parser](./new-parser.md) — future backends that would consume this
  layer rather than re-deriving the cursor a third time.
- `fjs/bnf/ll1/README.md` "Logical EOF and the complete cursor" and
  `fjs/bnf/descent/README.md` "Logical EOF and the complete cursor" — the two
  copies of the prose this issue gives one owner.

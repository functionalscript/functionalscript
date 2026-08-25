## 66E-parser-container-stack-bookkeeping. JSON/DJS parser: separate container-stack bookkeeping from container kind

**Priority:** P4
**Status:** open

### Problem

Both `fjs/media/json/parser/module.f.mjs` and `fjs/djs/parser/module.f.mjs` build the
container state machine out of four helpers — `startArray`, `startObject`,
`endArray`, `endObject`. The pop side is already deduplicated in both modules
via a shared `popStack` helper (`fjs/media/json/parser/module.f.mjs:59`,
`fjs/djs/parser/module.f.mjs:272`), used by both `endArray` and `endObject`.
What remains is the push side: the two `start*` helpers in each module still
share their *entire* stack-push body verbatim — only the `status` label and
the empty-container literal differ between array and object.

#### JSON (`fjs/media/json/parser/module.f.mjs:46-49,79-82`)

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

The pop side (`endArray`/`endObject`) already shares its body through
`popStack`:

```ts
const popStack = stack => {
    const ne = next(stack)
    return ne === null
        ? { status: '', top: null, stack: null }
        : { status: '', top: ne.first, stack: ne.tail }
}

const endArray = state => {
    const array = toArray(state.top.values)
    const newState = popStack(state.stack)
    return pushValue(newState)(array)
}

const endObject = state => {
    const obj = fromMap(state.top.values)
    const newState = popStack(state.stack)
    return pushValue(newState)(obj)
}
```

#### DJS (`fjs/djs/parser/module.f.mjs:262-303`)

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
```

DJS's `endArray`/`endObject` also already share their pop body through a local
`popStack` helper (`fjs/djs/parser/module.f.mjs:272`), mirroring JSON's.

So the `newStack` push appears **four** times across the two modules — twice
per module, byte-identical modulo the container-kind literal — while the pop
side is already down to one `popStack` per module. The repeated push is not a
trivial one-liner: it's a conditional (`state.top === null ? null : { first,
tail }`) that decides whether to grow the stack. This is exactly the case
`AGENTS.md` calls out — "when two code branches share most of their
structure, refactor so the shared part appears once and only the difference
lives in the conditional" — and it is also a separation-of-concerns point:
*manipulating the container stack* is a distinct concern from *which
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

const startArray  = startContainer('[')({ kind: 'array', values: null })
const startObject = startContainer('{')({ kind: 'object', values: null, key: '' })
```

The empty-container literal is now evaluated once at module load and shared
across calls (sound, since the values are immutable), and the stack push
lives in exactly one place. `endArray`/`endObject` are unchanged — they
already share their pop body through the existing `popStack` helper — so only
`startArray`/`startObject` shrink to one-line derivations whose body *is* the
array-vs-object difference and nothing else.

The DJS module gets the same treatment, keeping its `{ ...state, ... }` spread
inside `startContainer` and its tuple containers in the `top` argument.
`endArray`/`endObject` need no change there either, since DJS's `popStack`
already covers the pop side.

### Why this is filed at P4

The individual helpers are readable as they stand, so this is a cleanup, not a
correctness fix — hence not high priority. It is worth doing when either parser
is next touched, and it is a natural prerequisite for
[i157-json-djs-shared-core](./157.md): that issue wants to
*share one value-machine across json and djs*, and the cleaner the per-module
start/end building blocks are first, the smaller the surface that shared core has
to absorb. The two efforts are complementary, not overlapping — 157 removes
duplication **between** the two parsers; this removes duplication **within** each
one and can land independently of 157.

### Tasks

- [x] Pop side: both modules already share their pop body via a `popStack`
      helper (`fjs/media/json/parser/module.f.mjs:59`,
      `fjs/djs/parser/module.f.mjs:272`), used by `endArray`/`endObject`.
- [ ] In `fjs/media/json/parser/module.f.mjs`, add `pushStack` / `startContainer`
      (or equivalently named); derive `startArray` / `startObject` from them.
- [ ] Apply the same shape to `fjs/djs/parser/module.f.mjs`, preserving the
      `{ ...state }` spread.
- [ ] Run `npx tsc` and `fjs t`; confirm `fjs/media/json/parser/proof.f.mjs` and
      `fjs/djs/parser/proof.f.mjs` still pass with full line/branch coverage
      (behaviour is unchanged — this is a pure refactor).

### Related

- [i157-json-djs-shared-core](./157.md) — the larger effort
  to share one value-machine across json and djs; this issue tidies the per-module
  start/end helpers it would build on.
- [i165-layered-parser](../../bnf/todo/layered-parser.md) — adjacent parser-architecture
  cleanup.

## 66E-parser-container-stack-bookkeeping. JSON parser: separate container-stack bookkeeping from container kind

**Priority:** P4
**Status:** open

### Problem

[`../parser/module.f.mjs`](../parser/module.f.mjs) builds its container state machine out of
four helpers — `startArray`, `startObject`, `endArray`, `endObject`. The pop side
is already deduplicated via a shared `popStack` helper
(`fjs/media/json/parser/module.f.mjs:59`), used by both `endArray` and
`endObject`. What remains is the push side: the two `start*` helpers still share
their *entire* stack-push body verbatim — only the `status` label and the
empty-container literal differ between array and object.

This was filed as a JSON **and** DJS issue; the DJS half is gone, and the section
below records why.

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

#### DJS — no longer applicable

This issue was filed when `fjs/djs/parser` ran the same container state machine,
with `startArray` / `startObject` / `popStack` spelled out beside JSON's. That
parser is now a BNF grammar over token symbols and those helpers are deleted, so
only the JSON side of the duplication is left — and one implementation is not
duplication.

Applying the shape "to both" would now mean recreating the deleted machine to
have something to apply it to. What survives is a JSON-only tidy-up, which is
what the rest of this issue describes.

### Proposal

Name the two stack operations once and parameterize the container-kind
difference:

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

### Why this is filed at P4

The individual helpers are readable as they stand, so this is a cleanup, not a
correctness fix — hence not high priority. It is worth doing when the JSON parser
is next touched. It no longer feeds
[i157-json-djs-shared-core](../../../djs/todo/157-json-djs-shared-value-machine.md), whose parser
sub-task is itself superseded for the same reason: with one parser rather than
two, there is nothing left to share.

### Tasks

- [x] Pop side: JSON already shares its pop body via a `popStack` helper
      (`fjs/media/json/parser/module.f.mjs:59`), used by `endArray`/`endObject`.
- [x] DJS side: **not applicable** — that parser is a BNF grammar now and the
      helpers this would have tidied no longer exist.
- [ ] In `fjs/media/json/parser/module.f.mjs`, add `pushStack` / `startContainer`
      (or equivalently named); derive `startArray` / `startObject` from them.
- [ ] Run `npx tsc` and `fjs t`; confirm `fjs/media/json/parser/proof.f.mjs`
      still passes with full line/branch coverage (behaviour is unchanged — this
      is a pure refactor).

### Related

- [i157-json-djs-shared-core](../../../djs/todo/157-json-djs-shared-value-machine.md) — its parser
  sub-task is superseded for the same reason this issue lost its DJS half: with
  one parser rather than two, there is no value-machine left to share.
- [i165-layered-parser](../../../bnf/todo/layered-parser.md) — adjacent parser-architecture
  cleanup.

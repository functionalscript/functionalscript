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

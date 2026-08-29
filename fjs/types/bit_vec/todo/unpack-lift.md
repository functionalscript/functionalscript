## Lift `Vec` operations over `Unpacked` once

**Priority:** P5
**Status:** open

### Problem

The module's one representation crossing — `unpack`/`pack`
(`../module.f.mjs:145-155`) — is hand-rolled at each `Vec`-level operation
instead of being lifted once. Inside `bo`, three closures over
`unpackPopFront(len)` differ only in projection and packing:

```js
// ../module.f.mjs:276-297
const front = len => {
    const f = unpackPopFront(len)
    return v => f(unpack(v))[0]
}
const removeFront = len => {
    const f = unpackPopFront(len)
    return v => pack(f(unpack(v))[1])
}
const popFront = len => {
    const f = unpackPopFront(len)
    return v => {
        const [uint, u] = f(unpack(v))
        return [uint, pack(u)]
    }
}
```

The comment above them (`:272-273`) asserts "`front` and `removeFront` are
the **two** projections of `unpackPopFront`" — but `popFront` is a third
spelling of the same lift, unmentioned. The binary operations repeat the
"unpack both, combine" preamble the same way: `op` (`:165-171`), `concat`
(`:299-303`), and `cmp` (`:315-323`) each open with
`const au = unpack(a); const bu = unpack(b)`.

### Proposal

One private lift per shape, next to `unpack`/`pack`:

```js
/** `unpackPopFront` over `Vec` input: the one unary lift. */
const onUnpacked = len => {
    const f = unpackPopFront(len)
    return v => f(unpack(v))
}
```

Each projection binds the lift **once at the `len` scope**, exactly where
`unpackPopFront(len)` is bound today — the partial application belongs at its
dependency's scope (`fjs/AGENTS.md`, "Place curried partial applications at
their dependency's scope"), and a per-call `onUnpacked(len)(v)` would rebuild
the closure on every vector:

```js
const front = len => {
    const f = onUnpacked(len)
    return v => f(v)[0]
}
const removeFront = len => {
    const f = onUnpacked(len)
    return v => pack(f(v)[1])
}
```

`popFront` packs the pair the same way — three bodies over one crossing,
keeping `front`'s property of not packing a rest it does not return. A
`lift2 = f => a => b => f(unpack(a))(unpack(b))` similarly opens `op`,
`concat`, and `cmp`. Update the `:272-273` comment to name all three
projections. This is a readability change, not an optimization: bound this
way, the closures built per `len` and per codec stay exactly as they are.

### Tasks

- [ ] Add the unary and binary lifts; rewrite the six sites through them,
      binding each lift at the scope its argument depends on.
- [ ] `npx tsc`, `fjs t`; both bit orders' proofs pass unchanged.

### Related

- `../module.f.mjs:176-182` — `mappedListToVec`'s note is the same
  bind-once-per-codec discipline these lifts would make uniform.

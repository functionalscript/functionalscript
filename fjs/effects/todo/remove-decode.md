## remove-decode. Drop `decode` / `Decoded` in favour of `typeof e === 'function'`

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/module.f.ts:283` defines the only shape-inspecting function:

```ts
export const decode = <O extends Operation, T>(e: Effect<O, T>): Decoded<O, T> =>
    typeof e === 'function'
        ? { done: true, result: e() }
        : { done: false, command: e[0], payload: e[1], continuation: e[2] }
```

It buys nothing over writing `typeof e === 'function'` at the two places that
need it:

- **No narrowing is gained.** `Effect<O, T> = Pure<T> | Do<O, T>` is a function
  type unioned with an object type, so `typeof e === 'function'` is already a
  complete discriminant — TypeScript narrows to `Pure<T>` / `Do<O, T>` with no
  tag and no helper. `decode` re-encodes that narrowing as a `done: boolean`
  and then re-narrows on it, one indirection later.
- **No information is hidden.** `Decoded` (line 265) is declared *in terms of*
  the tuple it claims to hide — `Do<O, T>[0]`, `[1]`, `[2]` — and its three
  fields map 1:1 onto those positions. A representation change that broke
  `e[0]/e[1]/e[2]` would break `Decoded` too, so the stated benefit ("the
  representation can change without touching interpreters", lines 9-13 and
  274-282) does not hold.
- **It costs an allocation per step.** `step` and `match` are the inner loop of
  every interpreter; each iteration allocates a fresh `Decoded` object that is
  destructured once and discarded.

`decode` has exactly two non-proof call sites, both in the same file:
`step` (line 153) and `match` (line 311).

### Proposal

Delete `decode` and `Decoded`, and inline the check at both call sites.

```ts
export const step = <O extends Operation, T, Q extends Operation, R>(
    e: Effect<O, T>,
    f: (t: T) => Effect<Q, R>
): Effect<O | Q, R> =>
    typeof e === 'function'
        ? f(e())
        : doFull<O | Q, R, O[0]>(e[0], e[1], x => step(e[2](x), f))

export const match =
    <O extends Operation, R>(map: OperationMap<O, R>) =>
    <O1 extends O, T>(e: Effect<O1, T>): MatchResult<O1, T, R> =>
        typeof e === 'function'
            ? ['done', e()]
            : ['cont', map[e[0]](...e[1]), e[2]]
```

Verified: the `step` form above typechecks under `--strict` against the current
types with no casts — the `typeof` guard alone narrows the union.

`match` stays as the single eliminator interpreters go through, and
`MatchResult` remains the abstraction boundary for them: it is a real sum
(`['done', T] | ['cont', R, Cont]`) that already hides the layout, which is
what `Decoded` was reaching for. Runners keep using `match`; only the two
definitions here touch the raw shape.

Proof sites (`fjs/effects/proof.f.ts:6,69,74,79,120,132`,
`fjs/effects/eff/proof.f.ts:6`, `fjs/effects/node/proof.f.ts:19,23`) move to the
same check. The shared helper collapses:

```ts
const assertPure = <O extends Operation, T>(e: Effect<O, T>, expected: T) => {
    assert(typeof e === 'function', e)
    assertEq(e(), expected)
}
```

The `proof.decode` case (line 78) becomes a `Do`-layout proof — it asserts
`e[0] === 'add'`, the payload, and that the continuation returns a pure effect
— or is dropped in favour of the existing `match` proofs, whichever leaves the
layout covered exactly once. The node proof's `while (!d.done)` loop rewrites
against the raw effect:

```ts
let d: Effect<…> = e
while (typeof d !== 'function') {
    assertEq(d[0], 'readFile')
    assert(d[1][0] === 'hello', d[1])
    d = d[2](['ok', vec8(0x15n)])
}
assertEq(d(), 0x2An)
```

The module doctrine has to be restated, not just deleted. Four JSDoc blocks
name `decode` as the sole shape-reader: the `@module` header (lines 9-13),
`Cont`'s variance argument (lines 96-102), `Do`'s layout note (lines 116-119),
and `step`'s summary (lines 146-147). The invariant they protect survives in a
narrower form — *`step` and `match` are the only readers of the layout;
everything else goes through `match`* — and `Cont`'s soundness argument is
unaffected (tag dispatch still happens first, now in `match` directly), but the
"exactly one function" and "no second `typeof` check" wording is the thing being
removed and must be replaced rather than left contradicting the code.

### Tasks

- [ ] Inline the `typeof` check in `step` and `match`; delete `decode` and
      `Decoded` from `fjs/effects/module.f.ts`.
- [ ] Rewrite the four JSDoc blocks (module header, `Cont`, `Do`, `step`) to
      state the narrower invariant; keep `Cont`'s `out O` justification intact.
- [ ] Update `fjs/effects/proof.f.ts`, `fjs/effects/eff/proof.f.ts`, and
      `fjs/effects/node/proof.f.ts`; keep coverage of the `Do` layout in exactly
      one proof.
- [ ] `npx tsc` clean; `fjs t` passes.
- [ ] CHANGELOG entry.

### Related

- `fjs/effects/module.f.ts:283` — `decode`, the function to remove.
- `fjs/effects/module.f.ts:297-315` — `MatchResult` / `match`, the eliminator
  that keeps interpreters off the raw layout after the removal.

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

### Consumers

`decode` is exported, so `fjs/effects/module.d.ts` ships it — removing it is a
**breaking change** to the published API, not an internal cleanup. Every
importer must be migrated in the same PR (AGENTS.md, *Pull Requests*).

Two non-proof call sites, both inside the defining module:

| Site | Use |
|---|---|
| `fjs/effects/module.f.ts:153` | `step` |
| `fjs/effects/module.f.ts:311` | `match` |

Proof importers, repo-wide:

| File | Lines | Use |
|---|---|---|
| `fjs/effects/proof.f.ts` | 6, 69, 74, 79, 120, 132 | `assertPure`; `okStep`, `decode`, `frameStep` cases |
| `fjs/effects/eff/proof.f.ts` | 6 | `assertPure` (duplicate of the above) |
| `fjs/effects/node/proof.f.ts` | 19, 23 | drive a `Do` loop to completion |
| `fjs/cas/proof.f.ts` | 289, 298, 312, 321 | three "assert pure, read result"; one `Do` + `continuation` cast |
| `fjs/media/type/proof.f.ts` | 16 | `runPure` (same helper again) |

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
what `Decoded` was reaching for. Runners keep using `match`.

#### Give the proof sites an eliminator instead of the raw check

Rewriting all nine proof sites to `typeof e === 'function'` would spread the
layout across five files — trading one helper for many open-coded checks, which
is the opposite of the point. It is also unnecessary: **six of the nine sites
want the same thing**, "this effect is pure, give me its value" — `assertPure`
in `fjs/effects/proof.f.ts:5`, the byte-identical copy in
`fjs/effects/eff/proof.f.ts:5`, `runPure` in `fjs/media/type/proof.f.ts:15`,
and three inline repeats in `fjs/cas/proof.f.ts`. That helper is already
triplicated today; `decode` is just how each copy spells it.

So export the eliminator the copies are approximating — this is
`fjs/media/type/proof.f.ts`'s `runPure` promoted almost verbatim, which already
has exactly this signature:

```ts
/** Runs a fully pure effect to its value. Returns `null` if `e` is a `Do`. */
export const runPure = <T>(e: Effect<never, T>): T | null =>
    typeof e === 'function' ? e() : null
```

`Effect<never, T>` already says "no operations", so a `Do` here is a type error
at nearly every call site; the `null` covers the residual case without throwing.
The six sites become `assertEq(runPure(e), expected)`, the two duplicate
`assertPure` definitions collapse into it, and `fjs/media/type` and `fjs/cas`
stop importing `decode` entirely.

This *adds* one export while removing two, and the net API is smaller and more
honest: `runPure` states an intent (`run this pure effect`) where `decode`
exposed a representation.

That leaves three sites that genuinely inspect a `Do`, and they should:

- `fjs/effects/proof.f.ts:78` — the `decode` case becomes the layout proof,
  asserting `e[0] === 'add'`, the payload, and `runPure(e[2](5)) === 5`. This is
  the one place the representation is pinned on purpose.
- `fjs/effects/node/proof.f.ts:19,23` and `fjs/cas/proof.f.ts:321` — both drive
  a command loop, which is exactly what `match` is for. Route them through
  `match` with the relevant operation map rather than the raw tuple; the cas
  site also drops its `d.continuation as (...)` cast, since `MatchResult` types
  the continuation.

#### Wording of the invariant

The replacement invariant must not overstate. "`step` and `match` are the only
readers of the layout" would be false the moment the layout proof lands, so
state the exception where it can be checked:

> `step` and `match` are the only readers of the `Pure`/`Do` layout. Everything
> else — interpreters, and proofs outside the layout proof in
> `fjs/effects/proof.f.ts` — goes through `match` or `runPure`.

That is both true after the change and a real constraint: a `typeof` check
appearing in a fourth place is a review flag.

Four JSDoc blocks currently name `decode` as the sole shape-reader and must be
restated in those terms, not just stripped: the `@module` header (lines 9-13),
`Cont`'s variance argument (lines 96-102), `Do`'s layout note (lines 116-119),
and `step`'s summary (lines 146-147). `Cont`'s soundness argument survives
unchanged in substance — tag dispatch still happens first, now in `match`
directly — but the "exactly one function" and "no second `typeof` check"
wording is precisely what this change invalidates, so it must be replaced
rather than left contradicting the code.

### Tasks

- [ ] Inline the `typeof` check in `step` and `match`; delete `decode` and
      `Decoded` from `fjs/effects/module.f.ts`.
- [ ] Add `runPure` with JSDoc and proof coverage (including the `Do` → `null`
      branch).
- [ ] Rewrite the four JSDoc blocks (module header, `Cont`, `Do`, `step`) to
      state the invariant as worded above; keep `Cont`'s `out O` justification
      intact.
- [ ] Migrate all five proof importers — `fjs/effects/proof.f.ts`,
      `fjs/effects/eff/proof.f.ts`, `fjs/effects/node/proof.f.ts`,
      `fjs/cas/proof.f.ts`, `fjs/media/type/proof.f.ts` — in this PR; no
      importer may be left behind. Collapse the duplicated `assertPure` /
      `runPure` helpers; keep the `Do` layout pinned in exactly one proof.
- [ ] `npx tsc` clean; `fjs t` passes.
- [ ] CHANGELOG entry prefixed `**BREAKING CHANGES:**` — `decode` and `Decoded`
      are removed from the published `.d.ts`, so external importers break.

### Related

- `fjs/effects/module.f.ts:283` — `decode`, the function to remove.
- `fjs/effects/module.f.ts:297-315` — `MatchResult` / `match`, the eliminator
  that keeps interpreters off the raw layout after the removal.

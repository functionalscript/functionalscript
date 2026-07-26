## remove-decode. Drop `decode` / `Decoded` in favour of `typeof e === 'function'`

**Priority:** P3
**Status:** open

### Problem

> Line references below are against `d0096a3`. `decode`'s JSDoc was expanded on
> `main` after this issue was filed; see *Upstream objection* before
> implementing.

`fjs/effects/module.f.ts:330` defines the only shape-inspecting function:

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
- **Very little is hidden, and not for free.** `Decoded` (line 305) does
  insulate its callers from the positional layout — that much of the module
  header's claim (lines 9-14) is real. But it is declared *in terms of* the
  tuple, as `Do<O, T>[0]` / `[1]` / `[2]`, with its three fields mapping 1:1
  onto those positions, and it insulates exactly two internal callers plus the
  proofs. In exchange every consumer learns a second vocabulary
  (`done`/`result`/`command`/`payload`/`continuation`) for a shape it can
  already read. That is a poor rate of exchange, not a free abstraction.

The case rests on those two points alone — this is an API-simplicity change,
not an optimization. Dropping the per-step `Decoded` allocation is a
*consequence* of the simpler API, not a reason to make the change: no
measurement or observed limit is offered here, so per AGENTS.md ("never
optimize prematurely… a measured problem, not a hunch") it must not be used as
justification. If the allocation ever proves to matter, that is a separate
issue with a benchmark attached.

### Upstream objection

`decode`'s JSDoc (lines 325-329, added on `main` after this issue was filed)
already argues against this change:

> The `Decoded` record is allocated per call and unpacked immediately by every
> caller, so nothing ever holds one. Reading the layout directly in a caller
> would remove that allocation at the cost of a second copy of the shape test
> to keep in sync — not a trade to make without a measured reason.

**This must be settled before implementing, and it is the reviewer's call.**
The note is correct on its own terms, and it disposes of the allocation
argument entirely — which is why the allocation is not offered as
justification above.

Where this issue disagrees is the framing of the cost. The note weighs the
trade as *allocation vs. a duplicated shape test*, and on that framing it wins.
This issue argues the trade is different: **a second vocabulary for every
consumer vs. a shape test in three places.** After `runPure`, the readers are
`step`, `match`, and one deliberate layout proof — not the open-ended
duplication the note guards against — and what is bought is the removal of a
whole intermediate type from the module's surface.

If the reviewer holds the note's framing, this issue should be closed as
won't-fix and the reasoning recorded in the module (per `todo/README.md`, a
won't-fix is documented and the file deleted) rather than left open.

### Consumers

`decode` is exported, so `fjs/effects/module.d.ts` ships it — removing it is a
**breaking change** to the published API, not an internal cleanup. Every
importer must be migrated in the same PR (AGENTS.md, *Pull Requests*).

Two non-proof call sites, both inside the defining module:

| Site | Use |
|---|---|
| `fjs/effects/module.f.ts:193` | `step` |
| `fjs/effects/module.f.ts:358` | `match` |

Proof importers, repo-wide:

| File | Lines | Use |
|---|---|---|
| `fjs/effects/proof.f.ts` | 6, 52, 57, 62, 103, 115 | `assertPure`; `okStep`, `decode`, `frameStep` cases |
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
/** Runs an effect that reaches its value without performing a command.
 *  Returns `null` if `e` is a `Do`. */
export const runPure = <O extends Operation, T>(e: Effect<O, T>): T | null =>
    typeof e === 'function' ? e() : null
```

The op-set must stay generic. Narrowing the parameter to `Effect<never, T>` —
"this effect has no operations" — reads well but does not typecheck against the
sites being migrated: `Effect` is *covariant* in `O`, so `Effect<never, T>` is
assignable to `Effect<AddOp, T>` and not the reverse. Continuations produce the
wider type, so `e[2](5)` in the layout proof and `r[2](r[1])` after a `match`
are both `Effect<AddOp, …>` and are rejected:

```
error TS2345: Argument of type 'Effect<AddOp, number>' is not assignable to
parameter of type 'Effect<never, number>'.
  Type 'AddOp' is not assignable to type 'never'.
```

`Do<never, T>` is also uninhabited, which would make the `Do` → `null` branch
untestable without a cast. The generic form above avoids both problems and
matches the shape the existing `assertPure` helpers already use. Verified: all
four migration shapes — `pure`, `lazy`, a continuation `e[2](5)`, and a `match`
continuation `r[2](r[1])` — typecheck under `--strict`, and the `Do` → `null`
branch is reachable for proof coverage.

The six sites become `assertEq(runPure(e), expected)`, the two duplicate
`assertPure` definitions collapse into it, and `fjs/media/type` and `fjs/cas`
stop importing `decode` entirely.

This *adds* one export while removing two, and the net API is smaller and more
honest: `runPure` states an intent (`run this pure effect`) where `decode`
exposed a representation.

That leaves three sites that genuinely inspect a `Do`, and they should:

- `fjs/effects/proof.f.ts:62` — the `decode` case becomes the layout proof,
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

Four JSDoc blocks currently name `decode` and must be restated in those terms,
not just stripped: the `@module` header (lines 9-14), `Cont`'s variance
argument (line 122), `Do`'s layout note (line 143), and `decode`'s own block
(lines 317-329), which goes with the function. `step`'s summary no longer
mentions `decode` as of `d1c733b` and needs no change. `Cont`'s soundness
argument survives
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

- `fjs/effects/module.f.ts:330` — `decode`, the function to remove.
- `fjs/effects/module.f.ts:344-361` — `MatchResult` / `match`, the eliminator
  that keeps interpreters off the raw layout after the removal.

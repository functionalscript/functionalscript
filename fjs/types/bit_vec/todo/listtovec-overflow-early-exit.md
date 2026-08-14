## Stop `tryListToVec` walking past the overflow

**Priority:** P3
**Status:** open

### Problem

`tryListToVec` / `tryU8ListToVec` fold a `List<Vec>` through `monoid.fold` over
a `Nullable<Unpacked>` monoid whose `null` is an absorbing "longer than
`maxLength`" element ([`../module.f.mjs`](../module.f.mjs), `tryUnpackConcat`).
Once a combine yields `null`, every later combine yields `null` too — the answer
is already decided — but the fold keeps pulling elements to the end of the list.

`List<T>` includes `Thunk<T> = () => List<T>`, so "the end of the list" may not
exist. On an unbounded lazy list whose prefix already overflows, these two
functions never return; the earlier short-circuiting implementation (a
`list.tryFold` accumulator that bailed out the moment the running length crossed
the cap) answered `null` at the element that crossed it, pulling nothing further.
Measured on the PR that introduced the fold: `null` in ~2 ms before, still
pulling at 200 000 elements past the overflow after.

This matters because overflow is an ordinary outcome, not an exotic one:
`maxLength` is `0x100000` bits — 128 KiB — so any byte stream larger than that
reaches it, and a `try`-prefixed function returning `Nullable<Vec>` is exactly
what a caller reaches for when handed an untrusted or generated stream.

Every in-repo caller passes a finite list today, so nothing is broken right now;
the hazard is in the published API.

### Proposal

Put the early exit in `fjs/common/monoid`, not back in `bit_vec` — driving the
walk by hand there is the duplication the shared balanced `fold` just removed.

An absorbing element is the general shape of "the answer is already decided":
`absorbing op x = x op absorbing = absorbing`, so a fold may stop as soon as any
run equals it, and the result is the same as walking to the end. That is a
property of the algebra, so the combinator can exploit it without knowing
anything about bit vectors.

Add an absorbing-element companion to `Monoid<T>` and a fold that uses it:

```js
/**
 * @template T
 * @typedef {{
 *  readonly monoid: Monoid<T>
 *  readonly absorbing: T
 * }} Absorbing
 */

/** @type {<T>(a: Absorbing<T>) => (list: List<T>) => T} */
export const foldAbsorbing = ...
```

Composition, not intersection (AGENTS.md §6.2): `Monoid<T>` stays exactly as it
is, independently constructed and consumed, and `repeat`/`fold` are untouched.

The implementation reuses this module's existing `push`/`combine` helpers with
`list.tryFold` driving the walk: the accumulator is the same run stack, and
`update` returns `null` — `tryFold`'s "stop" — when a merge produces
`absorbing`. `end` runs `combine` as today. So the balanced grouping, the order
discipline, and the `log2(n)` stack bound are unchanged; only the walk gets an
exit.

`bit_vec` then passes `{ monoid: tryUnpackConcat(unpackConcat), absorbing: null }`
and drops the JSDoc paragraph warning that unbounded lazy input never returns.

Open question for whoever takes this: whether equality against `absorbing`
should be `===` (enough for `null`, and for every absorbing element that is a
primitive or a singleton) or a supplied `Equal<T>`. Prefer `===` until a second
consumer needs otherwise — a needless `Equal<T>` parameter on every call site is
a worse API than adding it later.

### Tasks

- [ ] Add `Absorbing<T>` and `foldAbsorbing` to `fjs/common/monoid`, built on
      the existing `push`/`combine` helpers plus `list.tryFold`.
- [ ] Prove it stops: a lazy list that throws (or counts pulls) past the
      overflow point, asserting the extra elements are never pulled.
- [ ] Route `tryListToVec` / `tryU8ListToVec` through it and remove the
      non-termination warning from `tryUnpackConcat`'s JSDoc.
- [ ] `npx tsc`, `fjs t`, `npm run cov`; both modules stay at 100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `tryUnpackConcat` documents the current
  limitation.
- [`../../../common/monoid/module.f.mjs`](../../../common/monoid/module.f.mjs) —
  the balanced `fold`, `push`, and `combine` this builds on.
- [`../../list/module.f.mjs`](../../list/module.f.mjs) — `tryFold`, the
  short-circuiting list walk, and the `Accumulator` it takes.

# Move `repeatSeq` to a generic `iterate` combinator

**Priority:** P4
**Status:** open

## Problem

`fjs/crypto/vdf/module.f.ts:38-46` defines a fully generic "apply `f` to a
value `n` times" combinator inside the VDF module:

```ts
const repeatSeq = (steps: bigint) => (f: Unary) => (value: bigint): bigint => {
    let v = value
    let i = 0n
    while (i < steps) {
        v = f(v)
        i = i + 1n
    }
    return v
}
```

It is used twice (`fjs/crypto/vdf/module.f.ts:56-60`), differing only in the
iterated function:

```ts
const squareLoop  = (steps: bigint) => (value: bigint): bigint => repeatSeq(steps)(pow2)(reduce(value))
const modSqrtLoop = (steps: bigint) => (value: bigint): bigint => repeatSeq(steps)(root)(reduce(value))
```

Nothing in `repeatSeq` is VDF-specific — it is the sequential sibling of the
monoid `repeat` (exponentiation by squaring,
`fjs/common/monoid/module.f.ts:84-98`). Monoid `repeat` cannot serve here
because Sloth is deliberately sequential (one step at a time is the whole
point of a VDF), which is exactly why a distinct combinator is warranted —
but function iteration is a `fjs/types/function` concern, not a crypto
concern. No generic iterate exists there today (`fjs/types/function`
exports only `compose`/`fn`). This is the same separation-of-concerns
pattern as `fjs/crypto/sign/todo/variadic-concat-to-bit-vec.md`: a general
combinator living in (and only serving) a leaf crypto module.

## Proposal

Add a generic combinator to `fjs/types/function/module.f.ts`:

```ts
/** Applies `f` to `value` `n` times sequentially. */
export const iterate = (n: bigint) => <T>(f: (v: T) => T) => (value: T): T => { ... }
```

(keeping the internal `let`/`while` — a recursive form would overflow the
stack for the large step counts VDFs use). `squareLoop`/`modSqrtLoop` call
`iterate`; the local `repeatSeq` is deleted. Alternative home: a
bigint-typed form next to `Unary` in `fjs/types/bigint/module.f.ts`, but the
combinator is not bigint-specific in `T` — only the counter is — so
`fjs/types/function` is the natural owner.

Per the `AGENTS.md` separation-of-concerns rule this move is appropriate
even with a single consuming module, because the logic is conceptually
distinct from the module that holds it.

## Tasks

- [ ] Add `iterate` to `fjs/types/function/module.f.ts` with proof coverage.
- [ ] Replace `repeatSeq` in `fjs/crypto/vdf/module.f.ts` with it.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- `fjs/common/monoid/module.f.ts:84-98` — `repeat`, the logarithmic
  (associative-operation) sibling; document the sequential/parallel
  distinction in JSDoc when adding `iterate`.
- `fjs/crypto/sign/todo/variadic-concat-to-bit-vec.md` — the same
  "general helper stranded in a leaf crypto module" pattern.

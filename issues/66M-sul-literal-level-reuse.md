# 66M-sul-literal-level-reuse. `literalToVec` rebuilds the SUL levels the pipeline already holds

**Priority:** P4
**Status:** open

## Problem

`fs/sul/level/literal/module.f.ts` states one fact — *the first three literal SUL
levels have exponents `0n`, `2n`, `7n`* — but states it **twice**, and builds the
three `Level` objects **twice**.

First, eagerly, for the streaming pipeline:

```ts
// fs/sul/level/literal/module.f.ts:88-90
const l1 = level(0n)
const l2 = level(2n)
const l3 = level(7n)
```

Then again, lazily, for the bit-vector decoders — `literalToVec` takes the
exponent `e` and calls `level(e)` *internally*:

```ts
// :118-131
const literalToVec = (prior: LiteralToVec, e: bigint): LiteralToVec => {
    const m = map(prior)
    const { decode } = level(e)            // <- second construction of the same Level
    return literal => listToVec(m(decode(literal)))
}

export const literal1ToVec: LiteralToVec = literalToVec(vec1, 0n)   // 0n repeated
export const literal2ToVec: LiteralToVec = literalToVec(literal1ToVec, 2n)  // 2n repeated
export const literal3ToVec: LiteralToVec = literalToVec(literal2ToVec, 7n)  // 7n repeated
```

So `level(0n)`, `level(2n)`, `level(7n)` are each constructed once for the encoder
(`l1`/`l2`/`l3`) and a second time inside `literalToVec`, and the exponent triple
`0n, 2n, 7n` is written in two separate places that must stay in lockstep. Adding
a level, or changing an exponent, means editing both lists or the two stay
inconsistent — a classic single-source-of-truth violation.

## Proposal

`literalToVec` only needs the level's `decode`, which the already-built `l1`/`l2`/
`l3` expose. Pass the `Level` (or its `decode`) instead of the exponent, and
derive the decoders from the same three objects the pipeline uses:

```ts
const literalToVec = (prior: LiteralToVec, { decode }: Level): LiteralToVec => {
    const m = map(prior)
    return literal => listToVec(m(decode(literal)))
}

export const literal1ToVec: LiteralToVec = literalToVec(vec1, l1)
export const literal2ToVec: LiteralToVec = literalToVec(literal1ToVec, l2)
export const literal3ToVec: LiteralToVec = literalToVec(literal2ToVec, l3)
```

Now the exponents `0n, 2n, 7n` appear exactly once (in `l1`/`l2`/`l3`), `level`
is called three times instead of six, and the encoder pipeline and the
`*ToVec` decoders are visibly built from the *same* three `Level` values rather
than two parallel constructions that happen to agree. Behaviour is unchanged —
`literalToVec` already used only `decode` from the `level(e)` it built.

## Tasks

- [ ] Change `literalToVec`'s second parameter from `e: bigint` to a `Level` (or
      `{ decode }`), drop the internal `level(e)` call, and pass `l1`/`l2`/`l3`
      at the three call sites.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/sul/level/literal/proof.f.ts` still
      passes with full line/branch coverage.

## Related

- The same module's `pipelineStep` (`:102-110`) is the other consumer of
  `l1`/`l2`/`l3`; after this change both consumers share one set of `Level`
  objects.

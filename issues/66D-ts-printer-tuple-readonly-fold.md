# 66D-ts-printer-tuple-readonly-fold. `types/ts`: fold the `tuple` readonly branch through `ro`

**Priority:** P5
**Status:** open

## Problem

`fs/types/ts/module.f.ts`'s `printer` already computes the readonly prefix once
as `ro`, then uses it for `struct`, `array`, and `record` — but `tuple`
re-derives the same `mut` distinction with a whole second `complex(...)` call
instead of reusing `ro`:

```ts
// :31-40
export const printer = (mut?: true): Printer => {
    const ro = mut ? '' : 'readonly'
    return {
        tuple: (mut ? complex('[', ']') : complex('readonly[', ']')),
        struct: (fields) => structX(fields.map(([k, v]) => `${ro}${JSON.stringify(k)}:${v}`)),
        array: (type: string) => `${ro}(${type})[]`,
        record: (type: string) => structX([`${ro}[k in string]?:${type}`]),
    }
}
```

The two `complex(...)` arms differ only in the `'readonly'` prefix on the open
bracket — which is exactly what `ro` already encodes (`'readonly['` when not
`mut`, `'['` when `mut`). The ternary makes a reader confirm the two arms are
identical except for that token, the same diff cost AGENTS.md's branch-sharing
rule targets ("refactor so the shared part appears once and only the difference
lives in the conditional").

## Proposal

Drop the per-`tuple` ternary and build the open delimiter from `ro`, matching how
`struct` / `array` / `record` already consume it:

```ts
tuple: complex(`${ro}[`, ']'),
```

Behaviour is unchanged (`readonly[…]` when immutable, `[…]` when `mut`); the
`mut`/`readonly` decision now lives in exactly one place (`ro`) for all four
emitters.

## Why this is filed at P5

A one-line readability cleanup in a single module — worth doing if the file is
touched anyway, not on its own.

## Tasks

- [ ] Replace the `tuple` ternary with `complex(\`${ro}[\`, ']')`.
- [ ] Confirm `fs/types/ts/proof.f.ts` still passes (`fjs t`) with both the
      mutable and readonly tuple paths covered and `npx tsc` is clean.

## Related

- [i662-rtti-ts-printer-visit](./662-rtti-ts-printer-visit.md) — adjacent
  `ts` printer work.

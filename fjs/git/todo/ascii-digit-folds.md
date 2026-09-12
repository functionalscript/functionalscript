## ascii-digit-folds. Three modules each fold ASCII digit bytes by hand

**Priority:** P4
**Status:** open

### Problem

Three git modules carry their own arithmetic over ASCII digit *bytes*:

```js
// object/module.f.mjs:92-95
const decimal = digits => {
    const n = digits.reduce((n, d) => n * 10 + d - 0x30, 0)
    return (digits.length === 1 || digits[0] !== 0x30) && isSafeInteger(n) ? n : null
}
// ident/module.f.mjs:68-71
const canonical = digits => digits.length === 1 || digits[0] !== 0x30
const decimal = digits => digits.reduce((n, d) => n * 10n + BigInt(d - 0x30), 0n)
// tree/module.f.mjs:59-60
const octal = digits => digits.reduce((n, d) => n * 8n + BigInt(d - 0x30), 0n)
```

The digit-class predicates repeat too: `d >= 0x30 && d <= 0x39` in
`ident/module.f.mjs:120` and `d >= 0x30 && d <= 0x37` in
`tree/module.f.mjs:57`. The one rule that is genuinely shared semantics —
Git refuses a non-canonical decimal spelling, the same rule for an
envelope size and an ident's time — is stated twice with no link between
the copies, and the `0x30` magic number lives in five places across three
files. `fjs/text/ascii` owns this layer (`hexDigitValue`,
`hexDigitCodePoint`, `digitRange`) but has no decimal/octal fold, so each
git module reaches past it.

### Proposal

One shared pair, beside `hexDigitValue` in `fjs/text/ascii/module.f.mjs`
if the general home is wanted, or in a small `fjs/git` shared module if
the Git-specific canonicality rule argues against it:

```ts
/** Git's canonical spelling: no leading zero unless the number is zero. */
const isCanonicalDigits: (digits: readonly number[]) => boolean
/** The value the digit bytes spell in `radix`, `null` on a byte outside it. */
const digitsValue: (radix: bigint) => (digits: readonly number[]) => Nullable<bigint>
```

`object.decimal` becomes the canonicality check plus `digitsValue(10n)`
narrowed by `isSafeInteger`; `ident`'s `canonical`/`decimal` disappear
into the pair (`ident` already wants the bigint form); `tree.octal`
becomes `digitsValue(8n)` and its digit-range check rides the same
helper's refusal. `0x30` then lives once.

### Tasks

- [ ] Add `isCanonicalDigits`/`digitsValue` with proofs; pick the home
      (`fjs/text/ascii` vs. a git-local module) in the PR.
- [ ] Rewrite `object.decimal`, `ident.canonical`/`decimal`, `tree.octal`
      and the two digit-range predicates through them.
- [ ] `tsc`, `fjs test`.

### Related

- [packfiles.md](./packfiles.md) — packs are varint/binary-framed, not
  ASCII digits; this helper is not on that path.

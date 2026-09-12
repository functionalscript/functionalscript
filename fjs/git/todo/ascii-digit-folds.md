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

One shared pair, exported from `fjs/text/ascii/module.f.mjs` beside
`hexDigitValue`. That module is the owner: it already declares itself the
home of digit arithmetic over code points, and neither rule is
Git-specific — JSON refuses a leading zero by the same canonicality rule,
so a Git-local module would be the second copy waiting to happen.

```ts
/** Git's canonical spelling: no leading zero unless the number is zero. */
const isCanonicalDigits: (digits: readonly number[]) => boolean
/**
 * The value the ASCII decimal-digit bytes spell in `radix`, or `null`
 * where a byte is not a digit of that radix. `radix` is `2n`..`10n`.
 * @throws on a radix outside that range — a caller error no input can cause.
 */
const digitsValue: (radix: bigint) => (digits: readonly number[]) => Nullable<bigint>
```

**The alphabet is `0x30`–`0x39` and nothing else**, so the radix runs
`2n`..`10n`: a digit is a byte `d` with `0x30 <= d < 0x30 + radix`, and
any other byte — a letter, a sign, a space — makes the answer `null`.
Hexadecimal is deliberately *not* this function's business: `A`–`F` and
`a`–`f` already have an owner two lines up (`hexDigitValue`), and giving
`digitsValue` a letter alphabet would make one function two codecs. A
radix outside `2n`..`10n` is asserted against before any byte is read
(`digitsValue(16n)` throws; `digitsValue(1n)` and `digitsValue(0n)` too),
which is the repository's shape for a programmer error rather than an
input the function refuses. Both consumers here are `8n` and `10n`.

**The empty run is pinned as a refusal**, in both: `digitsValue(r)([])`
is `null` and `isCanonicalDigits([])` is `false`. An empty list spells no
number, and a public function that answered `0n` for it would be handing
out a plausible wrong value ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
The open-coded copies answer the other way — each fold is seeded with
`0`/`0n`, so an empty run reads as zero, and `[][0] !== 0x30` is `true`,
so it reads as canonical — which is one more reason to name the rule: today's callers reach the folds only with non-empty input
(`object`'s digits come from the grammar, `tree`'s `isMode` checks the
length first), and the PR confirms each remaining caller is non-empty by
construction or takes the new refusal explicitly.

`object.decimal` becomes the canonicality check plus `digitsValue(10n)`,
bounded **as a bigint** and only then converted — `n !== null && n <=
BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null` — since
`Number.isSafeInteger` is `false` for every bigint and would refuse
`blob 0\0`; `decimal` keeps its `Nullable<number>` result type; `ident`'s `canonical`/`decimal` disappear
into the pair (`ident` already wants the bigint form); `tree.octal`
becomes `digitsValue(8n)` and its digit-range check rides the same
helper's refusal. `0x30` then lives once.

### Tasks

- [ ] Add `isCanonicalDigits`/`digitsValue` to `fjs/text/ascii` with
      proofs, the empty case (`false` / `null`) pinned.
- [ ] Rewrite `object.decimal`, `ident.canonical`/`decimal`, `tree.octal`
      and the two digit-range predicates through them.
- [ ] `tsc`, `fjs test`.

### Related

- [packfiles.md](./packfiles.md) — packs are varint/binary-framed, not
  ASCII digits; this helper is not on that path.

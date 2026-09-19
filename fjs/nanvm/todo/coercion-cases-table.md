## coercion-cases-table. Ten operator groups restate the `ToNumeric` operand table

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) already factors a shared operand list
twice — `numberCoercionCases(negate)` for `+n`/`-n` ("keeps the two groups
from drifting apart") and `comparisonCases` with `relationCases` for the
four relations ("the move `numberCoercionCases` already makes … and no
cleverer than it"). Ten binary groups do not follow: `mulCases`,
`divCases`, `expCases`, `subCases`, `remCases`, `bitAndCases`,
`bitOrCases`, `bitXorCases`, `shiftLeftCases`, `signedRightShiftCases`,
`unsignedRightShiftCases` each open with the same left operands in the
same order against a fixed right operand:

```js
// divCases                                                   // bitAndCases
{ name: 'nullDividedByFour', args: [null, 4], expected: 0 },  { name: 'nullBitAndSix', args: [null, 6], expected: 0 },
{ name: 'undefinedDividedByFour', args: [undefined, 4], … },  { name: 'undefinedBitAndSix', args: [undefined, 6], … },
{ name: 'trueDividedByFour', args: [true, 4], … },            { name: 'trueBitAndSix', args: [true, 6], … },
{ name: 'stringTenDividedByFour', args: ['10', 4], … },       { name: 'stringTenBitAndSix', args: ['10', 6], … },
{ name: 'emptyArrayDividedByFour', args: [[], 4], … },        { name: 'emptyArrayBitAndSix', args: [[], 6], … },
```

The five bitwise and shift groups repeat a second identical block —
truncation, `NaN`, the infinities, the 32-bit wrap — and every arithmetic
group ends with the same `number`/`bigint` mixed pair that throws. An
operand added to the coercion space today lands in whichever lists someone
remembers, in the JavaScript proof and in the generated
`nanvm-lib/tests/test/generated.rs` alike; the `comparisonCases` comment
records that this drift has already narrowed the Rust suite once.

### Proposal

The third instance of the module's own move: one operand table and a
`coercionCases(op, right, rightWord)(f)` that yields the shared rows with
`f` applied to the coerced left value, plus a `int32Cases` block for the
five bitwise groups. Each group then states its operator, its fixed right
operand, and what is genuinely its own — `div`'s signed zeros and
infinities, `**`'s special cases, the bigint rows.

### Tasks

- [ ] The table and the two factories; the ten groups rewritten; case names
      unchanged so the generated Rust test names are stable.
- [ ] `npm run gen`; `tsc`, `fjs test`, `cargo test`.

### Related

- [corpus-as-conformance-vectors.md](./corpus-as-conformance-vectors.md) —
  extends the case lists; cheaper once they are one table.

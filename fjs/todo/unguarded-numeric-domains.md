## Guard the remaining numeric domains against non-integers

**Priority:** P4
**Status:** open

### Problem

`utf8ByteToCodePointOp` and `utf16ByteToCodePointOp` now both check
`Number.isInteger` before dispatching, because their range partitions cover
only the *integers* in range and a fraction falls between two arms.

The root cause is one line — `contains = (b, e) => i => b <= i && i <= e`
(`../types/range/module.f.mjs:10`). It is a numeric range, nothing more, so
every predicate built on it answers `true` for a fraction inside its bounds,
however integral the domain its doc describes. Arithmetic downstream then
truncates with `>>`, `&`, or `|`, and the fraction disappears into a plausible
result.

**The list below is what one sweep found, not a proof of completeness.** Its
criterion: an export whose contract is stated over an integer domain, whose
check is a bare `contains` range, and which answers for a non-integer instead
of rejecting it. Add a row when another turns up rather than trusting the
length of this one — it has been revised upward twice already.

None of these is a live defect: none is reachable from a `Vec`, a `u8List`, or
a `string`, the inputs every in-tree caller supplies.

**Predicates.** These come first, and are why the rest are reachable: a caller
that asks one of them has already been told the input is fine.

| site | input | answers | contract |
|---|---|---|---|
| `text/code_point`'s `isHighSurrogate` (`../text/code_point/module.f.mjs:93`) | `0xd800.5` | `true` | "the 16-bit word (`U16`)" |
| `text/code_point`'s `isLowSurrogate` (`:99`) | `0xdc00.5` | `true` | "the 16-bit word (`U16`)" |
| `text/code_point`'s `isBmpCodePoint` (`:115`) | `65.5` | `true` | "the code point" |
| `text/code_point`'s `isSupplementaryPlane` (`:122`) | `0x10000.5` | `true` | "code points `0x010000` - `0x10FFFF`" |
| `text/code_point`'s `isValidCodePoint` (`:137`) | `65.5` | `true` | "in the Unicode range … and not a surrogate" |
| `text/code_point`'s `isTextCodePoint` (`:161`) | `65.5` | `true` | "a code point at or above `0x0020` …" |

**Sites that trust them, or repeat the shape.**

| site | input | answers | contract |
|---|---|---|---|
| `text/utf8`'s `fromCodePointList` | `[65.5]` | `[65]` | truncates to a valid byte, silently |
| `text/utf16`'s `fromCodePointList` | `[65.5]` | `[65.5]` | emits the fraction as a code unit |
| `text/ascii`'s `hexDigitValue` (`../text/ascii/module.f.mjs:259`) | `53.5` | `5.5` | "the value `0..15` … or `null`" |
| `text/ascii`'s `hexDigitCodePoint` (`:271`) | `5.5` | `53.5` | "the … code point denoting a value in `0..15`" |
| `bnf`'s `rangeEncode` (`../bnf/module.f.mjs:77`) | `(65.5, 66)` | same as `(65, 66)` | `isValid` admits it, then `& mask` truncates |

`isSupplementaryPlane` is the sharpest: it *is* the gate in front of the
`>>`/`&` truncation in both encoders (`../text/utf8/module.f.mjs:132`,
`../text/utf16/module.f.mjs:78`), so the fraction reaches the shift through the
check meant to stop it, and both encoders then answer exactly as they would
for the integer:

```
utf16 fromCodePointList([0x10000.5])  ->  [55296, 56320]        // === [0x10000]
utf8  fromCodePointList([0x10000.5])  ->  [240, 144, 128, 128]  // === [0x10000]
```

Gate-then-truncate is not hypothetical: `../text/utf8/module.f.mjs:299-305` filters
every code point through `!isValidCodePoint(cp)` before encoding, and
`../media/type/module.f.mjs:157-158` gates on both predicates.

In the BMP arm the two encoders disagree with each other — `utf8` truncates
`[65.5]` to `[65]`, `utf16` emits `[65.5]` as a code unit — which is the tell
that neither decided what a non-integer means; each inherited whatever its
arithmetic did. Above the BMP they agree, because both truncate.

### Proposal

Fix `contains`'s consumers, not `contains` itself: a numeric range is the
right thing for a numeric range, and `types/range` has callers that are not
code-point predicates. Give each site the domain predicate the decoders now
have — `Number.isInteger(i) && <range>(i)` — most cheaply by making the
`code_point` predicates integral, since the encoders reach their arithmetic
through those.

Per site, decide what a rejected input becomes: `null`, an `errorMask`-tagged
code point, or an assertion. The decoders' answer was "tagged error, state
passed through"; an encoder has no error channel in its return type today, so
`fromCodePointList` needs that decision made rather than assumed. The
predicates and `hexDigitValue` need no such decision — all already answer
`false`/`null` for out-of-domain input, so a non-integer joins that branch.

### Tasks

- [ ] Make the six `code_point` predicates integral. This is the gate the
      encoders reach their truncation through, so it narrows everything below.
- [ ] `hexDigitValue`: `null` for a non-integer. `hexDigitCodePoint`: decide,
      since its return type has no `null` today.
- [ ] Decide what `fromCodePointList` does with a non-integer code point on
      both sides, and make `utf8` and `utf16` agree.
- [ ] `bnf`'s `isValid`: decide whether the assertion should reject a
      non-integer before `& mask` silently truncates it.
- [ ] Consider one `isCodePoint` owned by `text/code_point` rather than the
      several near-copies the table above lists.
- [ ] Re-sweep for exports built on `contains` once the above land, and record
      what the sweep covered so the next reader knows its limits.

### Related

- `../text/utf8/module.f.mjs` — `u8`, and `../text/utf16/module.f.mjs` — `u16`: the
  shape to copy, and the doc comments explaining why the integer check is not
  redundant with the range.
- The deleted `fjs/text/utf8/todo/byte-guard-accepts-non-integers.md` closed the
  UTF-8 decoder half of this class; this file keeps the rest of it tracked.
- It lives in `fjs/todo/` rather than under any one module's `todo/` because the
  class spans `text/`, `bnf/`, and `types/range/`, which is what
  [todo/README.md](../../todo/README.md) reserves this directory for.

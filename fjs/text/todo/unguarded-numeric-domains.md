## Guard the remaining numeric domains against non-integers

**Priority:** P4
**Status:** open

### Problem

`utf8ByteToCodePointOp` and `utf16ByteToCodePointOp` now both check
`Number.isInteger` before dispatching, because their range partitions cover
only the *integers* in range and a fraction falls between two arms. Seven
other sites have the same shape and no such check. All predate this issue and
none is reachable from a `Vec`, a `u8List`, or a `string` — the inputs every
in-tree caller supplies — so this is a domain-hygiene issue, not a live
defect.

The `text` decoders are done. What is left is the encode direction, two
`ascii` helpers, two `code_point` predicates, and one in `bnf`:

| site | input | answers | contract |
|---|---|---|---|
| `utf8`'s `fromCodePointList` | `[65.5]` | `[65]` | truncates to a valid byte, silently |
| `utf16`'s `fromCodePointList` | `[65.5]` | `[65.5]` | emits the fraction as a code unit |
| `ascii`'s `hexDigitValue` (`:259`) | `53.5` | `5.5` | "the value `0..15` … or `null`" |
| `ascii`'s `hexDigitCodePoint` (`:271`) | `5.5` | `53.5` | "the … code point denoting a value in `0..15`" |
| `code_point`'s `isValidCodePoint` (`:137`) | `65.5` | `true` | "in the Unicode range … and not a surrogate" |
| `code_point`'s `isTextCodePoint` (`:161`) | `65.5` | `true` | "a code point at or above `0x0020` …" |
| `bnf`'s `rangeEncode` (`:77`) | `(65.5, 66)` | same as `(65, 66)` | `isValid` admits it, then `& mask` truncates |

The two encoders disagree with each other on the same input, which is the
tell: neither decided what a non-integer means, so each inherited whatever its
arithmetic happened to do. The `ascii` pair is the sharpest — each returns a
value outside the range its own doc states. The two predicates answer `true`
for something that is not a code point at all, which is what lets the rest
through: a caller that asks `isValidCodePoint` first has already been told the
input is fine.

### Proposal

Give each site the domain predicate its decoder twin already has —
`Number.isInteger(i) && <range>(i)` — and decide, per site, whether a rejected
input is `null`, an `errorMask`-tagged code point, or an assertion. The
decoders' answer was "tagged error, state passed through"; an encoder has no
error channel in its return type today, so `fromCodePointList` needs that
decision made rather than assumed.

The two predicates and `hexDigitValue` need no design question: all three
already answer `false`/`null` for out-of-domain input, so a non-integer joins
that branch.

### Tasks

- [ ] `isValidCodePoint` and `isTextCodePoint`: answer `false` for a
      non-integer. Fixing these first narrows what the sites below can be
      handed.
- [ ] `hexDigitValue`: `null` for a non-integer. `hexDigitCodePoint`: decide,
      since its return type has no `null` today.
- [ ] Decide what `fromCodePointList` does with a non-integer code point on
      both sides, and make `utf8` and `utf16` agree.
- [ ] `bnf`'s `isValid`: decide whether the assertion should reject a
      non-integer before `& mask` silently truncates it.
- [ ] Consider whether `text/code_point` should own one `isCodePoint`
      predicate the way `u8`/`u16` are now written, rather than several
      near-copies.

### Related

- `fjs/text/utf8/module.f.mjs` — `u8`, and `fjs/text/utf16/module.f.mjs` —
  `u16`: the shape to copy, and the doc comments explaining why the integer
  check is not redundant with the range.
- The deleted `byte-guard-accepts-non-integers.md` closed the UTF-8 decoder
  half of this class; this file keeps the rest of it tracked.

## Guard the remaining numeric domains against non-integers

**Priority:** P4
**Status:** open

### Problem

`utf8ByteToCodePointOp` and `utf16ByteToCodePointOp` now both check
`Number.isInteger` before dispatching, because their range partitions cover
only the *integers* in range and a fraction falls between two arms. The same
shape is unguarded in four other places. All predate this issue and none is
reachable from a `Vec`, a `u8List`, or a `string` — the inputs every in-tree
caller supplies — so this is a domain-hygiene issue, not a live defect.

The `text` decoders are done; what is left is the encode direction and two
adjacent helpers:

| site | input | answers | contract |
|---|---|---|---|
| `utf8`'s `fromCodePointList` | `[65.5]` | `[65]` | truncates to a valid byte, silently |
| `utf16`'s `fromCodePointList` | `[65.5]` | `[65.5]` | emits the fraction as a code unit |
| `ascii`'s `hexDigitValue` (`:259`) | `53.5` | `5.5` | `0..15 \| null` |
| `bnf`'s `rangeEncode` (`:77`) | — | — | `isValid` admits a fraction, then `encodeTerminal` feeds it `& mask` |

The two encoders disagree with each other on the same input, which is the
tell: neither decided what a non-integer means, so each inherited whatever its
arithmetic happened to do. `hexDigitValue` is the sharpest of the four — it
returns a value outside its own stated range rather than the `null` it
promises for anything that is not a hex digit.

### Proposal

Give each site the domain predicate its decoder twin already has —
`Number.isInteger(i) && <range>(i)` — and decide, per site, whether a rejected
input is `null`, an `errorMask`-tagged code point, or an assertion. The
decoders' answer was "tagged error, state passed through"; an encoder has no
error channel in its return type today, so `fromCodePointList` needs that
decision made rather than assumed.

`hexDigitValue` is the one that can be fixed without a design question: its
return type is already `Nullable<number>`, so a non-integer is `null`.

### Tasks

- [ ] `hexDigitValue`: reject a non-integer with `null`; proof it.
- [ ] Decide what `fromCodePointList` does with a non-integer code point on
      both sides, and make `utf8` and `utf16` agree.
- [ ] `bnf`'s `isValid`: decide whether the assertion should reject a
      non-integer before `& mask` silently truncates it.
- [ ] Consider whether `text/code_point` should own one `isCodePoint`
      predicate the way `u8`/`u16` are now written, rather than four
      near-copies.

### Related

- `fjs/text/utf8/module.f.mjs` — `u8`, and `fjs/text/utf16/module.f.mjs` —
  `u16`: the shape to copy, and the doc comments explaining why the integer
  check is not redundant with the range.
- The deleted `byte-guard-accepts-non-integers.md` closed the UTF-8 decoder
  half of this class; this file keeps the rest of it tracked.

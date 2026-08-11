## Use `-1` as the BNF EOF symbol

**Priority:** P3
**Status:** open

### Problem

BNF currently represents EOF with the largest value in the terminal-symbol space.
With the current 24-bit symbols that means EOF is `2^24 - 1`; the planned bigint
migration similarly proposed reserving `2^256 - 1`.

This makes EOF depend on the physical input-symbol width and removes one otherwise
valid value from every symbol alphabet. A future uint256 input-symbol domain
should be able to use the complete range `0 .. 2^256 - 1` without requiring token
mappings or alphabet adapters to avoid one special value.

EOF is not a physical input symbol. Give it a width-independent semantic value
outside the non-negative physical-symbol domain instead.

### Proposal

Use:

```text
EOF = -1
```

Keep ordinary physical input symbols non-negative. Before the bigint migration,
the current domain remains:

```text
ordinary symbol = 0 .. 2^24 - 1
EOF             = -1
```

After the bigint-symbol migration, ordinary input can use the entire uint256
domain:

```text
ordinary symbol = 0 .. 2^256 - 1
EOF             = -1
```

EOF remains represented through the normal terminal-range abstraction rather than
introducing a separate terminal kind. `eof` is the singleton range containing
`-1`, while `fullRange` contains ordinary physical symbols only and complements
over `fullRange` do not include EOF.

#### Logical EOF in parser input

Alphabet adapters and callers provide only physical input symbols. They do **not**
append `-1` or manufacture metadata for EOF. Every parser/recognizer backend must
synthesize exactly one logical EOF immediately after the last physical input
symbol.

Keep public parser positions in the physical input domain:

```text
0 <= idx <= input.length
```

The parser's internal cursor must include both the physical position and logical
EOF-consumption state:

```text
cursor = (idx, eofConsumed)
```

Conceptually:

```text
idx < input.length
    -> match the physical input symbol
idx == input.length && !eofConsumed
    -> match EOF (-1)
idx == input.length && eofConsumed
    -> no symbol remains
```

Matching EOF changes the internal cursor from `(input.length, false)` to
`(input.length, true)`. It therefore **does count as parser progress**, even though
the public physical `idx` does not change.

Parser control flow must compare and snapshot the complete internal cursor, not
`idx` alone. In particular:

- sequencing observes the updated `(idx, eofConsumed)` state after a successful
  EOF match;
- variant/alternative selection treats an EOF-consuming branch as consuming
  input/progress and must not replace it with a later nullable branch merely
  because the public `idx` is unchanged;
- repetition uses complete-cursor equality for its no-progress/termination check,
  so consuming EOF is one real step rather than a nullable match;
- backtracking/failing alternatives restore both `idx` and `eofConsumed` to the
  branch-entry snapshot, so a failed branch that tentatively consumes EOF does
  not make EOF unavailable to a later branch.

Matching EOF does not advance a public physical position beyond the input.
Indexed results therefore report `input.length` after a successful EOF match, not
`input.length + 1`; remainder-based results continue to expose the empty physical
remainder. Public result normalization happens after internal parser control flow
has used the complete cursor state.

The synthesized EOF has no physical source element and contributes no ordinary
symbol/metadata leaf to the AST. Diagnostics that reject a terminal at EOF should
continue to point at the physical end position (`input.length`).

Failure high-water tracking must also use the complete internal cursor rather than
public `idx` alone. Order cursors lexicographically by physical position first and
EOF consumption second:

```text
(idx, false) < (idx, true)
```

Thus a failure after consuming logical EOF is farther than a failure before EOF at
the same physical index. Merge expected-terminal sets only for failures at the
same complete cursor. Select the farthest failure using this internal ordering,
then normalize its public reported position back to `idx`.

For example, on empty physical input, `[eof, x] | y` can reject `x` at
`(0, true)` and reject `y` at `(0, false)`. The `x` failure is the high-water
failure even though both publicly report index `0`; their expected sets must not
be merged.

This logical EOF behavior is part of this task, not deferred to the bigint
migration. Otherwise changing the exported `eof` range to `-1` before bigint
would make EOF grammars unmatchable because current physical inputs never contain
`-1`.

#### Unsigned `TerminalRange` endpoint encoding

Keep the semantic terminal value separate from the representation used inside a
`TerminalRange`. Before packing/storing an endpoint, offset it by one:

```text
encodeTerminal(value) = value + 1
decodeTerminal(value) = value - 1
```

This gives a non-negative encoded endpoint domain:

```text
EOF -> 0
0   -> 1
1   -> 2
...
```

The mapping is deterministic, lossless, and order-preserving. Range operations
should work with decoded semantic terminal values; packing/serialization details
should apply the offset only at the `TerminalRange` representation boundary.

This task can be implemented before switching BNF symbols to `bigint`. To preserve
the full current 24-bit physical-symbol domain, the temporary packed-number
representation needs 25 bits per encoded endpoint:

```text
encoded endpoint = 0 .. 2^24
packed range     = two 25-bit endpoints
```

Two 25-bit endpoints still fit exactly within the JavaScript safe-integer range.
The implementation may continue using `BigInt` internally for bit operations and
return a `number`, as the current range codec does.

Do not treat this temporary 25-bit packing as the final bigint `TerminalRange`
representation. The separate
[TerminalRange representation investigation](./terminal-range-representation.md)
still decides the persistent representation used with uint256 symbols. With the
`+1` endpoint encoding, an encoded uint256 endpoint can reach `2^256`, so a naive
fixed-width packed form would require 257 bits per endpoint rather than 256.

#### Range-map boundaries

`-1` becomes a valid semantic terminal value (EOF), so it must no longer be
described as an internal-only value below the BNF terminal domain.

Range-map cut points remain an implementation domain, not the terminal domain. A
cut point immediately below ordinary symbol `0` is `-1`, which now coincides with
EOF. If a cut point below EOF itself is needed, use `-2`. Generic range-map
boundaries may remain raw integers/bigints outside the semantic terminal domain.

### Tasks

- [ ] Define BNF EOF semantically as `-1` instead of the maximum physical-symbol
      value.
- [ ] Preserve the full current 24-bit ordinary-symbol domain `0 .. 2^24 - 1`.
- [ ] Update every parser/recognizer backend to synthesize exactly one logical EOF
      after physical input and track the internal cursor as `(idx, eofConsumed)`.
- [ ] Use complete internal-cursor equality, not public `idx` equality, for parser
      progress in sequencing, variant/alternative selection, and repetition.
- [ ] Snapshot and restore both `idx` and `eofConsumed` during backtracking so a
      failing branch cannot consume logical EOF permanently.
- [ ] Order diagnostic/high-water failures by the complete internal cursor and
      merge expected terminals only at the same complete cursor; normalize the
      selected failure to public `idx` only afterward.
- [ ] Keep public positions/remainders in the physical input domain after EOF
      consumption: indexed results report `input.length`, never `input.length + 1`.
- [ ] Keep synthesized EOF out of ordinary AST metadata leaves and preserve EOF
      diagnostics at the physical end position.
- [ ] Keep alphabet adapters/physical parser input restricted to non-negative
      ordinary symbols; callers must not append EOF.
- [ ] Encode/decode `TerminalRange` endpoints through the `value + 1` / `value - 1`
      mapping so the stored representation remains non-negative.
- [ ] Update the temporary packed-number codec to use 25 bits per endpoint while
      BNF symbols are still numbers.
- [ ] Define `eof` as the singleton `-1 .. -1` terminal range.
- [ ] Keep `fullRange` restricted to ordinary physical symbols and ensure
      complement helpers do not include EOF.
- [ ] Update range validation, containment, encode/decode helpers, range keys, and
      proofs for the new semantic/encoded boundary.
- [ ] Update BNF callers and proofs that assume EOF equals the largest 24-bit
      value.
- [ ] Update range-map documentation/tests so `-1` may be EOF as well as a cut
      point below ordinary symbol `0`; use `-2` when a raw cut point is required
      below EOF.
- [ ] Add proof coverage for EOF on empty/non-empty input, one-time EOF
      consumption, EOF branches inside variants, EOF inside repetition, nullable
      alternatives after an EOF branch, restoration after a failing branch,
      failure ordering on both sides of logical EOF at the same physical index,
      failure before physical end, public position normalization,
      minimum/maximum ordinary symbols, encode/decode round trips,
      singleton/general ranges, `fullRange`, and complements.
- [ ] Add the required `CHANGELOG.md` breaking-change entry if the implementation
      changes a published/serialized BNF representation.
- [ ] `npx tsc`, `fjs test`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — **blocked by this task**;
  keeps `EOF = -1` and expands ordinary symbols to the full uint256 domain.
- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — chooses the final range representation over the offset endpoint values.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit range codec and
  max-value EOF definition.
- [`fjs/bnf/types.ts`](../types.ts) — current packed-number `TerminalRange` type.

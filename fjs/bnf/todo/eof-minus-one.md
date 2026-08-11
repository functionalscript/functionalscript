## Use `-1` as the BNF EOF symbol

**Priority:** P3
**Status:** open

### Problem

BNF currently represents EOF with the largest value in the terminal-symbol space.
With the current 24-bit symbols that means EOF is `2^24 - 1`; the planned bigint
migration similarly proposes reserving `2^256 - 1`.

This makes EOF depend on the physical input-symbol width and permanently removes
one otherwise valid value from every symbol alphabet. In particular, a future
uint256 symbol domain should be able to use the full range `0 .. 2^256 - 1`
without requiring token mappings or alphabet adapters to avoid one special value.

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
described as an internal-only value below the BNF symbol domain.

Range-map cut points remain an implementation domain, not the terminal-symbol
domain. If a cut point below EOF is needed, it may be `-2` (and generic range-map
boundaries may remain raw integers/bigints outside the semantic terminal domain).
A cut point immediately below ordinary symbol `0` is `-1`, which now coincides
with EOF; that is valid as a boundary value but must not cause EOF to be included
in `fullRange` or ordinary-symbol complements.

### Tasks

- [ ] Define BNF EOF semantically as `-1` instead of the maximum physical-symbol
      value.
- [ ] Preserve the full current 24-bit ordinary-symbol domain `0 .. 2^24 - 1`.
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
- [ ] Keep alphabet adapters/physical parser input restricted to non-negative
      ordinary symbols; EOF is parser semantics, not a physical alphabet value.
- [ ] Update range-map documentation/tests so `-1` is no longer assumed to be
      outside the semantic BNF terminal domain; use a lower raw cut point when one
      is required below EOF.
- [ ] Update [256-bit bigint BNF symbols](./bigint-symbols.md) so it uses the full
      uint256 domain for ordinary symbols and depends on this task rather than
      reserving `2^256 - 1` for EOF.
- [ ] Update
      [Investigate TerminalRange representation](./terminal-range-representation.md)
      so candidate encodings operate on the offset endpoint values and account
      for the possible encoded endpoint `2^256`.
- [ ] Add proof coverage for EOF, minimum/maximum current ordinary symbols,
      encode/decode round trips, singleton/general ranges, `fullRange`, and
      complements.
- [ ] Add the required `CHANGELOG.md` breaking-change entry if the implementation
      changes a published/serialized BNF representation.
- [ ] `npx tsc`, `fjs test`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — should use `EOF = -1` and the
  full uint256 ordinary-symbol domain after this task.
- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — chooses the final range representation independently of the EOF semantic
  value.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit range codec and
  max-value EOF definition.
- [`fjs/bnf/types.ts`](../types.ts) — current packed-number `TerminalRange` type.

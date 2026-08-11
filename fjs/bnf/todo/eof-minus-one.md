## Use `-1` as the BNF EOF symbol

**Priority:** P3
**Status:** open

### Problem

BNF currently uses one 24-bit terminal value for EOF. The current terminal space is:

```text
ordinary symbols = 0 .. 2^24 - 2
EOF              = 2^24 - 1
```

This makes EOF depend on the physical symbol width. We want EOF to be a logical
symbol outside the non-negative physical-symbol domain.

### Proposal

Move EOF from the top of the current 24-bit domain to `-1`:

```text
before:
ordinary symbols = 0 .. 2^24 - 2
EOF              = 2^24 - 1

after:
EOF              = -1
ordinary symbols = 0 .. 2^24 - 2
```

This does **not** expand the current terminal space. There are still exactly
`2^24` terminal values.

The later bigint-symbol migration is a separate change. It may expand ordinary
symbols to the full uint256 domain:

```text
EOF              = -1
ordinary symbols = 0 .. 2^256 - 1
```

That later expansion is where a larger/final `TerminalRange` representation is
needed.

#### Keep the current 24-bit stored representation

The current packed `TerminalRange` can remain two 24-bit stored endpoints.
Only the semantic interpretation of the existing EOF code changes:

```text
encodeTerminal(-1)         = 2^24 - 1
encodeTerminal(0..2^24-2)  = 0..2^24-2

decodeTerminal(2^24 - 1)   = -1
decodeTerminal(0..2^24-2)  = 0..2^24-2
```

So the stored code previously used for EOF remains the stored code for EOF.
Ordinary symbols also keep their existing stored codes. The packed width and
serialized values therefore do not need a migration for this task.

The stored codes are an implementation representation, not semantic terminal
ordering. Range operations that care about semantic ordering must compare decoded
terminal values.

`eof` is the singleton semantic range `[-1, -1]`. `fullRange` contains only
ordinary physical symbols: `[0, 2^24 - 2]`. Complements over `fullRange` do not
include EOF.

#### Logical EOF in parser input

Callers and alphabet adapters provide physical ordinary symbols only. They do not
append `-1`. Parser/recognizer backends synthesize exactly one logical EOF after
the physical input.

Keep public parser positions physical:

```text
0 <= idx <= input.length
```

Internally, parser progress must include EOF consumption:

```text
cursor = (idx, eofConsumed)
```

At physical end:

```text
(input.length, false) --EOF--> (input.length, true)
```

Consuming EOF is parser progress even though public `idx` does not move.
Sequencing, alternatives, repetition, backtracking, and failure high-water
tracking must therefore use the complete cursor rather than `idx` alone.
Backtracking restores both fields.

For diagnostics, `(idx, true)` is farther than `(idx, false)`. Merge expected
terminals only for failures at the same complete cursor, then report the physical
`idx` publicly.

The synthesized EOF has no physical source element and contributes no ordinary
metadata leaf to the AST. EOF diagnostics point at `input.length`.

### Tasks

- [ ] Change semantic EOF from `2^24 - 1` to `-1`.
- [ ] Keep the current ordinary domain `0 .. 2^24 - 2` unchanged.
- [ ] Keep `TerminalRange` packed as two 24-bit stored endpoints.
- [ ] Encode semantic EOF as the existing stored code `2^24 - 1`; leave ordinary
      stored codes unchanged.
- [ ] Update range encode/decode, containment, validation, keys, and proofs to
      distinguish semantic terminal values from stored endpoint codes.
- [ ] Define `eof` as semantic `[-1, -1]` and `fullRange` as
      `[0, 2^24 - 2]`.
- [ ] Synthesize logical EOF exactly once in parser/recognizer backends; callers
      must not append EOF.
- [ ] Track parser cursor as `(idx, eofConsumed)` and use the complete cursor for
      progress, alternatives, repetition, backtracking, and diagnostic ordering.
- [ ] Keep public positions/remainders physical and keep synthesized EOF out of
      ordinary AST metadata.
- [ ] Update callers/proofs that assume semantic EOF is `2^24 - 1`.
- [ ] Add proofs for empty/non-empty input, one-time EOF consumption, EOF in
      alternatives/repetition, backtracking, diagnostic ordering, ordinary
      minimum/maximum values, and range encode/decode round trips.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — chooses the representation needed when the later bigint migration expands
  the terminal domain.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — later expands ordinary
  symbols to the full uint256 domain while keeping `EOF = -1`.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit range codec and EOF
  definition.
- [`fjs/bnf/types.ts`](../types.ts) — current packed-number `TerminalRange` type.

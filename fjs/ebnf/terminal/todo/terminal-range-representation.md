## Investigate TerminalRange representation

**Priority:** P5
**Status:** on-hold

Only [bigint-symbols](./bigint-symbols.md) needs a wider terminal domain, and it
is on hold, so there is nothing to choose a representation for. The terminal
stays what it is: a range set, a list of `number` boundaries
([ebnf-range-set](./ebnf-range-set.md)).

An investigation was carried out and closed unimplemented in
[#1671](https://github.com/functionalscript/functionalscript/pull/1671). It
recommended a packed bigint with fixed 257-bit halves and a `value + 1`
endpoint encoding, and measured it against the classical packed 24-bit
terminal of the time: slower to decode, and about eight and a half times
larger serialized. What decided it was not the codec but the classical IR,
which told its rule kinds apart by JavaScript type alone, so every structural
range form collided with a sequence, a variant or a repeat and was rejected
on that ground. That premise went with `fjs/bnf`: every data rule is now a
tagged tuple and a terminal is `['set', …]` of boundaries
([`../../data`](../../data/README.md)), so a list of bigint boundaries is a
structural form without the collision. Which representation to pick is open
again if this revives; #1671's measurements describe the classical terminal
and its canonicity argument (fixed width is canonical, a varint pair is not)
still holds.

### Problem

A terminal is a range set, a strictly increasing list of `number`
boundaries over the safe integers ([ebnf-range-set](./ebnf-range-set.md)),
and EOF is `-1` in the input, outside the domain of ordinary symbols. The
classical front end's packed `TerminalRange` — two 24-bit endpoint codes in
one `number` — went with `fjs/bnf`, and the investigation below was made
against it; its count of the bigint domain stands.

The representation question becomes necessary when ordinary symbols later
expand to the full uint256 domain:

```text
EOF              = -1
ordinary symbols = 0 .. 2^256 - 1
```

That domain has `2^256 + 1` semantic terminal values, so a single 256-bit unsigned
endpoint code cannot represent all terminals.

### Alternatives to investigate

Use a simple deterministic representation. Candidates include:

- an order-preserving non-negative encoding:

  ```text
  encodeTerminal(value) = value + 1
  decodeTerminal(value) = value - 1
  ```

  giving encoded endpoints `0 .. 2^256`; a fixed-width form therefore needs
  257 bits per endpoint;
- a structural range storing signed semantic endpoints directly;
- a canonical variable-width bigint encoding;
- other simple representations that preserve the same semantic domain.

A terminal is one tagged tuple of the serializable form, `['set', …]`
([`../../data`](../../data/README.md)), so a wider boundary type changes the
tuple's elements and nothing around them.

A terminal is serialized grammar data and may be content-addressed, so the
chosen representation must be canonical and stable rather than an incidental
runtime optimization.

### Tasks

- [ ] Use the bigint terminal domain `[-1] | [0, 2^256 - 1]` as the required
      semantic domain.
- [ ] Compare fixed-width 257-bit endpoint encoding with simpler structural or
      variable-width alternatives.
- [ ] Require deterministic, canonical, lossless encode/decode semantics.
- [ ] Compare serialized size and containment/range-operation cost for EOF,
      bytes, Unicode, token symbols, and values near `2^256 - 1`.
- [ ] If using a structural representation, specify how `Rule` / `DataRule`
      remain unambiguous and serializable.
- [ ] Choose one representation for the bigint-symbol migration and document any
      serialized/public format migration it requires.

### Related

- [`fjs/ebnf/README.md`](../../README.md#terminals-and-eof) — the shipped
  `EOF = -1` semantics over range-set terminals.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — expands the terminal domain
  and consumes the representation selected here.
- [ebnf-range-set](./ebnf-range-set.md) — the range-set terminal, and why
  its boundaries are safe integers.

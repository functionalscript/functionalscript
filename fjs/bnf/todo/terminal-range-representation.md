## Investigate TerminalRange representation

**Priority:** P3
**Status:** open

### Problem

The current BNF `TerminalRange` packs two 24-bit endpoint codes into one
JavaScript `number`:

```text
range = start * 2^24 + end
```

Moving semantic EOF from `2^24 - 1` to `-1` does not require changing this
representation. The same 24-bit stored EOF code can continue to represent EOF,
and ordinary symbols remain `0 .. 2^24 - 2`.

The representation question becomes necessary when BNF ordinary symbols later
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

A structural representation may require changing the surrounding BNF rule/data
representation so terminal ranges remain unambiguous from sequences and variants.

`TerminalRange` is serialized BNF data and may be content-addressed, so the chosen
representation must be canonical and stable rather than an incidental runtime
optimization.

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

- [Use `-1` as the BNF EOF symbol](./eof-minus-one.md) — keeps the existing
  24-bit stored representation while changing EOF's semantic value.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — expands the terminal domain
  and consumes the representation selected here.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit packed range codec.

## Share number bit conversions

**Priority:** P2
**Status:** wip

### Problem

`media/rust` owns a reusable binary64 encoder, while the WAT formatter uses
typed arrays to decode binary32 and binary64 encodings. Number conversions
belong in the shared numeric library.

### Proposal

Move `bitsOf(number): bigint` to `types/number` and add pure
`fromBits(bigint): number` and `fromBits32(bigint): number` decoders. They read
the low 64 or 32 bits, preserving the typed arrays' width normalization.
Every decoded value is an ordinary FJS `number`; binary32 names an encoding,
not a new value type. Preserve signed zero, subnormals and infinities, and
the encoder's canonical NaN representation.

Use these helpers in the Rust writer, WASM emitter and WAT formatter. A
compiler pattern instruction can be considered later if performance needs it.

### Tasks

- [ ] Add the shared conversions and focused numeric proofs, update their
      consumers, and validate unchanged generated Rust and WAT output.

### Related

- Stacked on [#3910](https://github.com/functionalscript/functionalscript/pull/3910).

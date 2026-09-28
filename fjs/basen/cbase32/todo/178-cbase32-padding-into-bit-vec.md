## 178. `cbase32`: move bit-vector padding/trailing-zero logic into `bit_vec`

**Priority:** P3
**Status:** open

`fjs/basen/cbase32/module.f.mjs` hand-rolls two pieces of pure bit-vector arithmetic
that are conceptually `bit_vec` operations, not Base32 semantics: padding a
vector up to a 5-bit boundary with a "1-then-zeros" terminator, and recovering
the original length by scanning trailing zeros back to that terminator.

```js
// vecToCBase32 — pad to a multiple of 5 bits with a 1-then-0s marker
export const vecToCBase32 = v => {
    const len = length(v)
    const extraLen = 5n - len % 5n
    const last = 1n << (extraLen - 1n)
    const padded = concat(v)(vec(extraLen)(last))
    return vec5xToCBase32(padded)
}
```

`cBase32ToVec` strips the marker: it walks the string back one character at a
time, `popBack1`-ing each character's bits until it meets the sentinel `1`,
and rejects a string with no sentinel as `null`. It decodes a character at a
time on purpose — its comment says so — so that a non-canonical spelling with
trailing zero characters never materialises its padded body as one oversized
vector. The duplication this issue is about is unchanged: both functions are
still pure bit-vector arithmetic living in the Base32 codec instead of
`bit_vec`.

The "append a single set bit then zero-fill to a block boundary, and strip back
to that bit to recover the payload" scheme is the classic
Merkle–Damgård-style bit padding — a `bit_vec` concern. `cbase32` should express
its intent (`base32 over 5-bit groups`) and delegate the bit alignment.

### Proposed abstraction

Add to `fjs/types/bit_vec/module.f.mjs` a padding pair (and/or the trailing-zero
primitive the TODO asks for):

```ts
// pad v up to the next multiple of `block` bits using a 1-then-0s terminator
export const padToMultiple: (block: bigint) => (v: Vec) => Vec
// strip a 1-then-0s terminator added by padToMultiple; null if malformed/empty
export const unpadMultiple: (v: Vec) => Nullable<Vec>
```

`cbase32` then becomes `vecToCBase32 = v => vec5xToCBase32(padToMultiple(5n)(v))`
and `cBase32ToVec = s => { const v = cBase32ToVec5x(s); return v === null ? null : unpadMultiple(v) }`.

### Why this qualifies

- **Separation of concerns** is the primary justification: bit-alignment
  arithmetic (`5n - len % 5n`, `1n << (extraLen - 1n)`, the trailing-zero scan)
  belongs next to `vec`/`concat`/`length`/`popFront`, not interleaved with the
  Crockford alphabet codec. The author already flagged the strip half as a TODO
  wanting a `bit_vec`-level helper.
- It removes the `let`/`while` loops from `cbase32`, replacing them with a
  named, testable primitive.

### Caveats / why this is an idea, not a mechanical edit

- **The decode side must keep its bound.** `unpadMultiple` as sketched takes
  the whole decoded `Vec`, which is the materialisation `cBase32ToVec`'s
  per-character scan exists to avoid. Either the primitive works on the tail
  (the last non-zero character) and the caller concatenates the head, or the
  decode half stays in `cbase32`.
- **The aligned case keeps its terminator.** `5n - len % 5n` is `5n` when the
  length is already a multiple of five, so an aligned input still gets a full
  sentinel symbol. That is required, not incidental: `cBase32ToVec` rejects a
  string with no sentinel, and the proof round-trips a 5-bit payload through
  the extra terminator. `padToMultiple` must not "normalize" the aligned case to
  zero extra bits.
- **Single primary consumer.** Today only `cbase32` round-trips this padding, so
  this is the "single-consumer abstraction justified by clarity/separation"
  case, not a 2-consumer DRY extraction. base64 does not pad bits at all: its
  `encode` relies on `baseN`'s zero-extension of a trailing partial chunk and
  only appends `=` characters, so it is no second consumer either. SHA-2's
  padding (`framing` in `crypto/sha2/module.f.mjs`) looks similar but is *not*
  the same operation:
  it appends a length field and relies on the fixed-width compress word's
  implicit zero-extension rather than an explicit `padToMultiple`. Do **not**
  try to force SHA-2 onto this helper.
- **`block` generality.** `cbase32` only ever pads to 5; keep the `block`
  parameter so the primitive reads as a general bit-vec operation rather than a
  base32-specific one, but don't over-engineer beyond a single bigint argument.
- Relatedly, `fjs/asn.1/module.f.mjs` has a `round8` (round a bit length up to
  a byte boundary) that is the byte-aligned cousin of this concern; it is
  single-module today and out of scope here, but a future `bit_vec` alignment
  family could absorb both.

### Related

- [i167](../../../types/bit_vec/module.f.mjs) and
  [i168](../../../text/code_point/README.md#the-streaming-decoder-skeleton)
  — other `bit_vec`/text bit-level extractions; i168 shipped as `decoder` in
  `fjs/text/code_point/`.
- `fjs/types/bit_vec/module.f.mjs` — proposed home.

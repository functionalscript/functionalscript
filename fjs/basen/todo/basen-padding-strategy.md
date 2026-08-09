## Lift chunk-boundary padding into a `base_n` strategy layer

**Priority:** P4
**Status:** open

### Problem

`fjs/base_n/module.f.ts` already factors the core alphabet chunk codec into a
parameterized `baseN(bits, alphabet, normalize?)` factory, and both `base64` and
`cbase32` consume it (`fjs/basen/base64/module.f.ts:14`, `fjs/basen/cbase32/module.f.ts:27`).
That part of the DRY work is done.

The remaining duplication is one layer up, in the **padding** each codec wraps
around the shared `vecToString` / `stringToVec`. Both modules independently
implement "round the bit length up to a chunk-width multiple, append a pad
vector, encode; on decode, strip the padding".

`fjs/basen/base64/module.f.ts` (encode side) pads to a 6-bit boundary with zero bits
plus trailing `=` characters:

```ts
const rem = len % 24n
const padBits = rem === 0n ? 0n : 6n - rem % 6n
const v = padBits > 0n ? concat(input)(vec(padBits)(0n)) : input
let result = vecToString(v)
while (result.length % 4 !== 0) { result += '=' }
```

`fjs/basen/cbase32/module.f.ts` pads to a 5-bit boundary with a sentinel bit:

```ts
const extraLen = 5n - len % 5n
const last = 1n << (extraLen - 1n)
const padded = concat(v)(vec(extraLen)(last))
return vec5xToCBase32(padded)
```

The boundary arithmetic — `extra = bits - len % bits`, then
`concat(v)(vec(extra)(padValue))` — is structurally identical; only the pad
*value* (zeros + an external `=` rule vs. a sentinel bit), the matching unpad
rule, and the **already-aligned** behavior differ.

The already-aligned (`len % bits === 0n`) case is **not** a single shared rule —
it is genuinely strategy-specific and must stay so:

- base64 special-cases `rem === 0n` to add **0** pad bits; the decoder learns the
  original length from the count of trailing `=` characters.
- cbase32 uses an *in-band* sentinel: `5n - len % 5n` yields a full extra symbol
  (`5n`) when `len % 5n === 0n`, so an aligned input still carries a terminator
  symbol. This is required, not incidental — `cBase32ToVec` scans backward for the
  sentinel `1` bit and **rejects** any input with no sentinel
  (`fjs/basen/cbase32/module.f.ts:42-53`), and `fjs/basen/cbase32/proof.f.ts` proves a 5-bit
  payload round-trips with the extra terminator. If the shared boundary math
  treated aligned cbase32 like base64 (zero extra bits), aligned values would be
  rejected or have payload bits stripped.

So the strategy layer must let each codec own its aligned-case decision; do not
"normalize" it to a single rule across both.

> Note: `base128` (`fjs/basen/base128/module.f.ts`) is a variable-length
> continuation-bit (LEB128-style) `bigint ↔ Vec` codec, **not** an alphabet
> chunk codec. It correctly does not use `baseN` and is out of scope here.

### Proposal

Add an optional padding-strategy layer to `base_n`, e.g. a
`paddedBaseN(bits, alphabet, padStrategy, normalize?)` factory where
`padStrategy` supplies the pad value, the inverse unpad rule, the aligned-case
behavior (base64 adds nothing; cbase32 still emits a sentinel block), and, for
base64, an optional post-encode / pre-decode string transform for the `=`
characters. The shared `concat(v)(vec(extra)(padValue))` boundary application
lives once in `base_n`. `base64` and `cbase32` then declare only their pad value,
unpad rule, and aligned-case rule, and stop re-importing
`concat`/`vec`/`length`/`empty` for the boundary math
(`fjs/basen/base64/module.f.ts:6,12`, `fjs/basen/cbase32/module.f.ts:13`).

This is a "layer of abstraction for shared structure" extraction; per `AGENTS.md`
the second real consumer already exists (base64 and cbase32 both ship), so the
factory is justified — but it is P4 because the duplication is small and the two
pad strategies are genuinely different, so verify the abstraction stays readable
and doesn't obscure the per-codec pad semantics.

### Tasks

- [ ] Design the `padStrategy` shape (pad value, unpad, optional string
      transform) and add `paddedBaseN` to `fjs/base_n/module.f.ts`.
- [ ] Reimplement `base64` and `cbase32` padding on top of it; preserve each
      codec's aligned-case behavior (base64 adds 0 pad bits; cbase32 always emits
      a sentinel block, so its `cBase32ToVec` backward sentinel scan still finds a
      terminator).
- [ ] Remove the now-unused `msb`/`vec`/`length`/`empty` imports from `base64`
      and `cbase32`.
- [ ] Run `npx tsc` and `fjs t`; confirm round-trip proofs still pass.

### Related

- `fjs/base_n/todo/various-basen-encodings.md` — its "Base64" entry is **not**
  superseded by this work: that entry asks for an *identifier-safe* base64
  (alphabet `0-9 A-Z a-z _ $`), whereas `fjs/basen/base64/module.f.ts` is the standard
  RFC 4648 `+/` codec. The identifier variant is still unbuilt; this issue only
  refactors padding shared by the existing standard base64 and cbase32.

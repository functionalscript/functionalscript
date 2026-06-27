## Lift chunk-boundary padding into a `base_n` strategy layer

**Priority:** P4
**Status:** open

### Problem

`fs/base_n/module.f.ts` already factors the core alphabet chunk codec into a
parameterized `baseN(bits, alphabet, normalize?)` factory, and both `base64` and
`cbase32` consume it (`fs/base64/module.f.ts:14`, `fs/cbase32/module.f.ts:27`).
That part of the DRY work is done.

The remaining duplication is one layer up, in the **padding** each codec wraps
around the shared `vecToString` / `stringToVec`. Both modules independently
implement "round the bit length up to a chunk-width multiple, append a pad
vector, encode; on decode, strip the padding".

`fs/base64/module.f.ts` (encode side) pads to a 6-bit boundary with zero bits
plus trailing `=` characters:

```ts
const rem = len % 24n
const padBits = rem === 0n ? 0n : 6n - rem % 6n
const v = padBits > 0n ? concat(input)(vec(padBits)(0n)) : input
let result = vecToString(v)
while (result.length % 4 !== 0) { result += '=' }
```

`fs/cbase32/module.f.ts` pads to a 5-bit boundary with a sentinel bit:

```ts
const extraLen = 5n - len % 5n
const last = 1n << (extraLen - 1n)
const padded = concat(v)(vec(extraLen)(last))
return vec5xToCBase32(padded)
```

The boundary arithmetic — `extra = bits - len % bits`, then
`concat(v)(vec(extra)(padValue))` — is structurally identical; only the pad
*value* (zeros + an external `=` rule vs. a sentinel bit) and the matching unpad
rule differ.

There is also a subtle asymmetry worth normalizing during the extraction: base64
special-cases `rem === 0n` to add **0** pad bits, while cbase32's
`5n - len % 5n` yields a full extra symbol (`5n`) when `len % 5n === 0n`. Centralizing
the boundary math fixes the "already aligned" case once for both.

> Note: `base128` (`fs/base128/module.f.ts`) is a variable-length
> continuation-bit (LEB128-style) `bigint ↔ Vec` codec, **not** an alphabet
> chunk codec. It correctly does not use `baseN` and is out of scope here.

### Proposal

Add an optional padding-strategy layer to `base_n`, e.g. a
`paddedBaseN(bits, alphabet, padStrategy, normalize?)` factory where
`padStrategy` supplies the pad value and the inverse unpad rule (and, for base64,
an optional post-encode / pre-decode string transform for the `=` characters).
The chunk-boundary math lives once in `base_n`, correctly handling the
`len % bits === 0` case. `base64` and `cbase32` then declare only their pad value
and unpad rule, and stop re-importing `concat`/`vec`/`length`/`empty` for the
boundary math (`fs/base64/module.f.ts:6,12`, `fs/cbase32/module.f.ts:13`).

This is a "layer of abstraction for shared structure" extraction; per `AGENTS.md`
the second real consumer already exists (base64 and cbase32 both ship), so the
factory is justified — but it is P4 because the duplication is small and the two
pad strategies are genuinely different, so verify the abstraction stays readable
and doesn't obscure the per-codec pad semantics.

### Tasks

- [ ] Design the `padStrategy` shape (pad value, unpad, optional string
      transform) and add `paddedBaseN` to `fs/base_n/module.f.ts`.
- [ ] Reimplement `base64` and `cbase32` padding on top of it; confirm the
      `len % bits === 0` case is handled consistently.
- [ ] Remove the now-unused `msb`/`vec`/`length`/`empty` imports from `base64`
      and `cbase32`.
- [ ] Run `npx tsc` and `fjs t`; confirm round-trip proofs still pass.

### Related

- `fs/base_n/todo/various-basen-encodings.md` — note its "Base64" entry is now
  stale: `fs/base64/module.f.ts` is implemented and already uses `baseN`.

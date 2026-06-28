# UNICODE

## Shared code-point predicates

The code-point classification predicates — `isBmpCodePoint`, `isHighSurrogate`,
`isLowSurrogate`, `isSupplementaryPlane`, and `isValidCodePoint` — describe fixed
Unicode ranges, not per-encoding details, so they live in
[`code_point/module.f.ts`](./code_point/module.f.ts) alongside `errorMask` and
`decoder`. They are derived from one set of boundary constants so the surrogate
bounds (`0xD800`–`0xDFFF`) and the maximum code point (`0x10FFFF`) are spelled
out exactly once. UTF-8 and UTF-16 import them instead of redefining their own
range checks.

`isTextCodePoint` lives here too, but answers a different question: not whether a
code point is *well-formed* (`isValidCodePoint`) but whether it is *text*. A code
point is text unless it is a control character — C0 (`U+0000`–`U+001F`), `U+007F`
(DEL), and C1 (`U+0080`–`U+009F`) — minus the whitespace block `U+0009`–`U+000D`
(TAB, LF, VT, FF, CR), which is legitimate in text. The two are deliberately
distinct: a control byte such as NUL is perfectly valid UTF-8 yet not text, which
is exactly what `fs/mime` needs to split text from binary. `isValidCodePoint`
gates decoding (`fromVec`); `isTextCodePoint` gates classification.

`isValidCodePoint` was previously exported from `utf8/module.f.ts`; it now lives
solely on `code_point`. Importers — `fs/mime` and `utf8`'s own `fromVec` — take
it from `code_point` directly. This was a deliberate breaking change rather than
a re-export, on the principle that the predicate's canonical home is the shared
Unicode contract.

## UTF-8

Requirement: no loss for UTF8 => codepoint => UTF8

|utf8     |utf8 code                              |size     |codepoint                                         |
|---------|---------------------------------------|---------|--------------------------------------------------|
|[a]      |0xxx_xxxx                              |7 bit    |0_0000_0000_0000_0xxx_xxxx                        |
|[b,a]    |110x_xxxx 10xx_xxxx                    |11 bit   |0_0000_0000_0xxx_xxxx_xxxx + 0_0000_0000_1000_0000|
|[c,b,a]  |1110_xxxx 10xx_xxxx 10xx_xxxx          |16 bit   |0_0000_xxxx_xxxx_xxxx_xxxx + 0_0000_1000_0000_0000|
|[d,c,b,a]|1111_0xxx 10xx_xxxx 10xx_xxxx 10xx_xxxx|21 bit   |x_xxxx_xxxx_xxxx_xxxx_xxxx + 1_0000_0000_0000_0000|

|utf8 error|utf8 code                    |size  |codepoint          |
|----------|-----------------------------|------|-------------------|
|[e]       |1111_1xxx                    | 3 bit|                   |
|[d,]      |1111_0xxx                    | 3 bit|                   |
|[c,]      |1110_xxxx                    | 4 bit|                   |
|[b,]      |110x_xxxx                    | 5 bit|                   |
|[e]       |10xx_xxxx                    | 6 bit|0000_0000 1xxx_xxxx|
|[d,c,]    |1111_0xxx 10xx_xxxx          | 9 bit|0000_001x xxxx_xxxx|
|[c,b,]    |1110_xxxx 10xx_xxxx          |10 bit|0000_01xx xxxx_xxxx|
|[d,c,b,]  |1111_0xxx 10xx_xxxx 10xx_xxxx|15 bit|1xxx_xxxx xxxx_xxxx|

Total error states:

- 2^6 + 2^3 + 2^5 + 2^4 + 2^10 + 2^3 + + 2^9 + 2^15
- 2^4 + 2^6 + 2^5 + 2^4 + 2^10 + 2^9 + 2^15
- 2^5 + 2^6 + 2^5 + 2^10 + 2^9 + 2^15
- 2^6 + 2^6 + 2^10 + 2^9 + 2^15
- 2^7 + 2^9 + 2^10 + 2^15
- 0b1000_0110_1000_000
- 128 + 512 + 1024 + 32_768
- 34_432
- < 2^16

### utf8/module.f.ts

```ts
const toCodePointList: (input: List<u8|null>) => List<i32>
const fromCodePointList: (input: List<i32>) => List<u8>
```

## UTF-16

Requirement: no loss for UTF16 => codepoint => UTF16

0xD800..0xDFFF
0b_1101_1000_0000_0000
0b_1101_1111_1111_1111

0b_1101_1xxx_xxxx_xxxx : 11 bits

- first : 0xD800: 0b_1101_10xx_xxxx_xxxx : 10 bit
- second: 0xDC00: 0b_1101_11xx_xxxx_xxxx : 10 bit

|utf16    |utf16 code                             |size  |codepoint                                       |
|---------|---------------------------------------|------|------------------------------------------------|
|[a]      |xxxx_xxxx_xxxx_xxxx                    |16 bit|0000_xxxx_xxxx_xxxx_xxxx                        |
|[b,a]    |1101_10xx_xxxx_xxxx 1101_11xx_xxxx_xxxx|20 bit|xxxx_xxxx_xxxx_xxxx_xxxx + 1_0000_0000_0000_0000|

|utf16 error|utf16 code         |size  |codepoint          |
|-----------|-------------------|------|-------------------|
|[e]        |1101_11xx_xxxx_xxxx|10 bit|1101_11xx_xxxx_xxxx|
|[b,]       |1101_10xx_xxxx_xxxx|10 bit|1101_10xx_xxxx_xxxx|

Total error states: 11 bit

### utf16/module.f.ts

```ts
const toCodePointList : List<u16|null>) => List<i32>
const fromCodePointList: (input: List<i32>) => List<u16>
const stringToList: (input: string) => List<u16>
const listToString: (input: List<u16>) => string
```

UTF-16 => CP => UTF-8 => CP = UTF-16

## Example

- UTF-16:
  - 1101_11xx_xxxx_xxxx
  - 1101_11xx_xxxx_xxxx
- CP:
  - 1000_0000_0000_0000_1101_11xx_xxxx_xxxx
  - 1000_0000_0000_0000_1101_11xx_xxxx_xxxx
- UTF-8:
  - 1111_0.101
  - 10.11_xxxx
  - 10xx_xxxx
  - 1111_0.101
  - 10.11_xxxx
  - 10xx_xxxx
- CP:
  - 1000_0000_0000_0000_1101_11xx_xxxx_xxxx
  - 1000_0000_0000_0000_1101_11xx_xxxx_xxxx
- UTF-16:
  - 1101_11xx_xxxx_xxxx
  - 1101_11xx_xxxx_xxxx

# UNICODE

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

### utf8.f.cjs

```js
/** @type {(input: List<u8|undefined>) => List<i32>} */
const toCodePointList

/** @type {(input: List<i32>) => List<u8>} */
const fromCodePointList
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

### utf16.f.cjs

```js
/** @type {(input: List<u16|undefined>) => List<i32>} */
const toCodePointList

/** @type {(input: List<i32>) => List<u16>} */
const fromCodePointList

/** @type {(input: string) => List<u16>} */
const stringToList

/** @type {(input: List<u16>) => string} */
const listToString
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

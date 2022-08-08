# UNICODE

## UTF-8

Requirement: no loss for UTF8 => codepoint => UTF8

|utf8     |codepoint                              |size     |
|---------|---------------------------------------|---------|
|[a]      |0xxx_xxxx                              |7 bit    |
|[b,a]    |110x_xxxx 10xx_xxxx                    |11 bit   |
|[c,b,a]  |1110_xxxx 10xx_xxxx 10xx_xxxx          |16 bit   |
|[d,c,b,a]|1111_0xxx 10xx_xxxx 10xx_xxxx 10xx_xxxx|21 bit   |

|utf8 error|codepoint                    |size  |
|----------|-----------------------------|------|
|[e]       |10xx_xxxx                    |6 bit |
|[e]       |1111_1xxx                    |3 bit |
|[b,]      |110x_xxxx                    |5 bit |
|[c,]      |1110_xxxx                    |4 bit |
|[c,b,]    |1110_xxxx 10xx_xxxx          |10 bit|
|[d,]      |1111_0xxx                    |3 bit |
|[d,c,]    |1111_0xxx 10xx_xxxx          |9 bit |
|[d,c,b,]  |1111_0xxx 10xx_xxxx 10xx_xxxx|15 bit|

Total error states:

- 2^6 + 2^3 + 2^5 + 2^4 + 2^10 + 2^3 + + 2^9 + 2^15
- 2^4 + 2^6 + 2^5 + 2^4 + 2^10 + 2^9 + 2^15
- 2^5 + 2^6 + 2^5 + 2^10 + 2^9 + 2^15
- 2^6 + 2^6 + 2^10 + 2^9 + 2^15
- 2^7 + 2^9 + 2^10 + 2^15
- < 2^16

|utf8 error|codepoint                    |size  |map                |
|----------|-----------------------------|------|-------------------|
|[e]       |1111_1xxx                    | 3 bit|                   |
|[d,]      |1111_0xxx                    | 3 bit|                   |
|[c,]      |1110_xxxx                    | 4 bit|                   |
|[b,]      |110x_xxxx                    | 5 bit|                   |
|[e]       |10xx_xxxx                    | 6 bit|0000_0000 1xxx_xxxx|
|[d,c,]    |1111_0xxx 10xx_xxxx          | 9 bit|0000_001x xxxx_xxxx|
|[c,b,]    |1110_xxxx 10xx_xxxx          |10 bit|0000_01xx xxxx_xxxx|
|[d,c,b,]  |1111_0xxx 10xx_xxxx 10xx_xxxx|15 bit|1xxx_xxxx xxxx_xxxx|

```js
/** @type {(input: List<u8|undefined>) => List<i32>} */
const utf8ToCodePoint

/** @type {(input: List<i32>) => List<u8>} */
const codePointToUtf8
```

## UTF-16

Requirement: no loss for UTF16 => codepoint => UTF16

0xD800..0xDFFF
0b_1101_1000_0000_0000
0b_1101_1111_1111_1111

0b_1101_1xxx_xxxx_xxxx : 11 bits

- first : 0xD800: 0b_1101_10xx_xxxx_xxxx : 10 bit
- second: 0xDC00: 0b_1101_11xx_xxxx_xxxx : 10 bit

|utf16    |codepoint                              |size  |
|---------|---------------------------------------|------|
|[a]      |xxxx_xxxx_xxxx_xxxx                    |16 bit|
|[b,a]    |1101_10xx_xxxx_xxxx 1101_11xx_xxxx_xxxx|20 bit|

|utf16 error|codepoint          |size  |
|-----------|-------------------|------|
|[e]        |1101_11xx_xxxx_xxxx|10 bit|
|[b,]       |1101_10xx_xxxx_xxxx|10 bit|

Total error states: 11 bit

```js
/** @type {(input: List<u16|undefined>) => List<i32>} */
const utf16ListToCodePointList

/** @type {(input: List<i32>) => List<u16>} */
const codePointListToUtf16List

/** @type {(input: string) => List<u16> */
const stringToUtf16List

/** @type {(input: List<u16>) => string} */
const utf16ListToString
```

UTF-16 => CP => UTF-9 => CP = UTF-16

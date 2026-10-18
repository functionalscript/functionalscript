- 1 bit: sign
- 11 bits: exponent
- 52 bits: fraction

## NaN and Infinities

- exponent: `0b_111_1111_1111`.
- sign and fraction: 53 bits = 0x35 bits
- 3 special values:
  ```js
  //               3    3    2    2    2    2    1    1    1    1    0    0    0    0
  //               4    0    C    8    4    0    C    8    4    0    C    8    4    0
   Infinity === 0b_0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000
  -Infinity === 0b_1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000
   NaN // everything else
  ```

### Strings

- sizes:
  - `16 * 3 = 0x10 * 3 = 0x30 = 48`
  - `13 * 4 = 0x0D * 4 = 0x34 = 52`
  - `10 * 5 = 0x0A * 5 = 0x32 = 50`
  - ` 8 * 6 = 0x08 * 6 = 0x30 = 48`
  - ` 7 * 7 = 0x07 * 7 = 0x31 = 49`
- Symbol-size:
  - `16` - Utf-16.
  - `8` - Utf8.
  - `7` - ASCII
  - `6` - `64`:
    - `0..9` - 10 | 10
    - `A..Z` - 26 | 36
    - `a..z` - 26 | 62
    - `$`, `_` - 2 | 64
- By-length:
  - empty
  - one - `16` Utf16
  - two - `16x2 = 32`
  - three - `16x3 = 48`
  - four - `7x4 = 28` ASCII
  - five - `7x5 = 35`
  - six - `7x6 = 42`
  - seven - `7x7 = 49`
  - eight - `6x8 = 48` `0..9`, `A..Z`, `a..z`, `$_`

|Prefix|        |            |                |
|------|--------|------------|----------------|
|`00`  |`48 + 1`|`0..3` Utf16|                |
|`01`  |`48`    |`8` Id|UInt |It can be `0..8`|
|`1`   |`49 + 1`|`4..7` ASCII|It can be `0..7`|

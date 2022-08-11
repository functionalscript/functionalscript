# VM

## Tagged Pointers

https://en.wikipedia.org/wiki/Tagged_pointer

### Common (3 bit)

- `false`
- `true`
- `undefined`
- `""`
- `-infinity`
- `+infinity`
- `-0`
- `NaN`

### 32 bit platform

- `31` bigInt31 (-1_073_741_824..1_073_741_823)
- `31`:
  - `30`: pointer + null
  - `30`:
    - `29`:
      - `28`: 4 x 7 bit string
      - `28`: 2 x 14 bit string
    - `29`:
      - `28`: int28 (-134_217_728..134_217_727)
      - `28`:
        - `27`: 3 x 9 bit string
        - `20`: a UTF-16 surrogate pair
        - `16`: 1 x 16 bit string
        - `3`: common

### 64 bit platform

- `63`: 9 x 7 bit string
- `63`:
  - `62`:
    - `61`: pointer + null
    - `61`: float61
  - `62`:
    - `60`: 6 x 10 bit string
    - `60`: 5 x 12 bit string
    - `60`: 4 x 15 bit string
    - `60`:
      - `59`: bigInt59 (-576_460_752_303_423_488..576_460_752_303_423_487)
      - `59`:
        - `56`: 8 x 7-bit string
        - `56`: 7 x 8-bit string
        - `48`: 3 x 16 bit string
        - `32`: 2 x 16 bit string
        - `32`: int32
        - `16`: 1 x UTF16 string
        - `3`: common

### Float64

https://en.wikipedia.org/wiki/Double-precision_floating-point_format

- 1 bit - sign (S)
- 11 bit - exponent (E)
- 52 bit - fraction (F)

|E            |Description             |
|-------------|------------------------|
|000_0000_0000|F = 0: signed zeros     |
|             |F != 0: subnormals      |
|000_0000_0001|E = 2^-1022             |
|...          |                        |
|011_1111_1111|E = 2^0                 |
|100_0000_0000|E = 2^1                 |
|...          |                        |
|111_1111_1110|E = 2^1023              |
|111_1111_1111|F = 0: signed infinities|
|             |F != 0: NaN             |

### Float61

- 1 bit - sign
- 8 bit - exponent
- 52 bit - fraction

|E        |Description|
|---------|-----------|
|0000_0000|E = 2^-127 |
|...      |           |
|0111_1111|E = 2^0    |
|1000_0000|E = 2^1    |
|...      |           |
|1111_1111|E = 2^128  |

## Object Structure

- counter&type: 32 + float64: 64
- counter&type: 32 + object: len: 32 + payload
- counter&type: 32 + array: len: 32 + payload
- counter&type: 32 + function: 32 + 32
- counter&type: 32 + string: len: 32 + payload
- counter&type: 32 + bigint: len: 32 + payload

minimal size: 64 bit = 8 byte
alignment: 3 bit.

## Type

- 000 number
- 001 string
- 010 object
- 011 array
- 100 function
- 101 bigint
- 110 ...
- 111 ...
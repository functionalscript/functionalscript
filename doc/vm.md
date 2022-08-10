# VM

## Tagged Pointers

https://en.wikipedia.org/wiki/Tagged_pointer

### Common (17 bit)

- `{16} 0`: 1 UTF-16
- `{16} 1`:
  - `{3} 00000_00000000`:
    - `{2} 0`:
      - `00`: false
      - `01`: true
      - `10`: undefined
      - `11`: ""
    - `{2} 1`: double
      - `00`: -infinity
      - `01`: +infinity
      - `10`: -0
      - `11`: NaN`
  - `{3} NNNNN_NNNNNNNN`: reserved

### 32 bit platform

- `{31} 0`:
  - `{30} 0`: pointer + null
  - `{30} 1`:
    - `{28} 00`: 4 x 7 bit string
    - `{28} 01`: 2 x 14 bit string
    - `{28} 10`:
      - `{27} 0`: 3 x 9 bit string
      - `{27} 1`:
        - `{20} 0000000`: a UTF-16 surrogate pair
        - `{20} 0000001`:
          - `{17} 000`:  common
          - `{17} NNN`: reserved
        - `{20} NNNNNNN`: reserved
    - `{28} 11`: reserved
- `{31} 1`: int31

### 64 bit platform

- `{63} 0`:
  - `{62} 0`:
    - `{61} 0`: pointer + null
    - `{61} 1`: float61
  - `{62} 1`:
    - `{60} 00`: 6 x 10 bit string
    - `{60} 01`: 5 x 12 bit string
    - `{60} 10`: 4 x 15 bit string
    - `{60} 11`:
      - `{56} 0000`: 8 x 7-bit string
      - `{56} 0001`: 7 x 8-bit string
      - `{56} 0010`:
        - `{48} 00000000`: 3 x 16 bit string
        - `{48} NNNNNNNN`:
          - `{32} 00000000_00000000`: 2 x 16 bit string
          - `{32} 00000000_00000001`: int32
          - `{32} 00000000_00000010`:
            - `{17} 0000000_00000000`: common
            - `{17} NNNNNNN_NNNNNNNN`: reserved
          - `{32} NNNNNNNN_NNNNNNNN`: reserved
      - `{56} NNNN`: reserved
- `{63} 1`: 9 x 7 bit ASCII string

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
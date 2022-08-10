# VM

## Tagged Pointers

https://en.wikipedia.org/wiki/Tagged_pointer

### Common

- `XX0`:
  - `X00`: bool
    - `000`: false
    - `100`: true
  - `010`: undefined
  - `110`: ""
- `XX1`: double
  - `X01`: infinity
    - `001`: -infinity
    - `101`: +infinity
  - `011`: -0
  - `111`: NaN

### 32 bit platform

- `{31} 0`:
  - `{30} 0`: pointer + null
  - `{30} 1`:
    - `{28} 00`: 2 x 14 bit string
    - `{28} 01`:
      - `{27} 0`: 3 x 9 bit string
      - `{27} 1`:
        - `{20} 0000000`: a UTF-16 surrogate pair
        - `{20} 0000001`:
          - `{16} 0000`:  a UTF-16 symbol
          - `{16} 0001`:
            - `{4} 0000_00000000 `: common
            - `{4} NNNN_NNNNNNNN`: reserved
          - `{16} NNNN`: reserved
        - `{20} NNNNNNN`: reserved
    - `{28} 10`: 4 x 7 bit string
    - `{28} 11`: reserved
- `{31} 1`: int31

### 64 bit platform

- `{63} 0`:
  - `{61} 00`: pointer + null
  - `{61} 01`: float61
- `{63} 1`: 9 x 7 bit ASCII string

- 63
  - 62
    - 61 - pointer
    - 61 - float61
  - 62
    - 61
      - 60 - 6 x 10-bit symbols
      - 60 - 5 x 12-bit symbols
    - 61
      - 60 - 4 x 15-bit symbols
      - 60 ...
        - 57:
          - 56 - 8 x 7-bit symbols
          - 56 - 7 x 8-bit symbols
        - 57: ...
          - 48 - 3 x 16-bit symbols
          - 48: ...
            - 33:
              - 32 - 2 x 16-bit symbols
              - 32 - int32
            - 16 - 1 x 16-bit symbol
            - 4 - common values

## Float64

https://en.wikipedia.org/wiki/Double-precision_floating-point_format

- 1 bit - sign (S)
- 11 bit - exponent (E)
- 52 bit - fraction (F)

E:

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

## Float61

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

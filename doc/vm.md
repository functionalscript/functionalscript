# VM

## Tagged Pointers:

https://en.wikipedia.org/wiki/Tagged_pointer

### Common Values

- 4 bit:
- 2 bit: double constants:
    - 0 bit - NaN
    - 1 bit - infinities
    - 0 bit - `-0.0`
- 2 bit
    - 1 bit - bool
    - 0 bit - undefined
    - 0 bit - empty string

### 32 bit platform

- 31 bit - int31
- 31 bit
  - 30 bit - pointer + null
  - 30 bit
    - 29 bit
      - 2^28 - 4 x 7-bit ASCII symbols
      - 2^28 - 2 x 14-bit symbols
    - 29 bit
      - 28 bit - 4 x array of int7
      - 28 bit
        - 27 bit - 3 x 9-bit symbols
        - 27 bit ...
          - 20 bit - 1 x UNICODE as a surrogate pair.
          - 16 bit - 1 x UTF-16
          - 4 bit - common values

### 64 bit platform

- 63 - 9 x 7-bit ASCII symbols
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

## Float61

https://en.wikipedia.org/wiki/Double-precision_floating-point_format

- 1 bit - sign (S)
- 11 bit - exponent (E)
- 52 bit - fraction (F)

E:
- 000_0000_0000
  - F = 0: signed zeros
  - F != 0: subnormals
- 000_0000_0001: 2^-1022
- 011_1111_1111: 2^0
- 100_0000_0000: 2^1
- 111_1111_1110: 2^1023
- 111_1111_1111:
  - F = 0: signed infinities
  - F != 0: NaN

E7:
- 0111:
  - 000_0000: 2^-127
  - 111_1111: 2^0
- 1000:
  - 000_0000: 2^1
  - 111_1111: 2^128

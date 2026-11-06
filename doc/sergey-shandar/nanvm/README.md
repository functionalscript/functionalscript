# Low Level

## Structure

- `1` bit: sign
- `11` bits: exponent
- `52` bits: fraction

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

```
0
0    4    8    C
s111_1111_1111_vvvv - rest: 48bit

s111_1111_1111_00vv - infs/nan, primitives and short strings
s111_1111_1111_01vv - ptr + data_type
s111_1111_1111_1vvv - short bigint
```

### Primitives and Short Strings

`s-vv` + 48 bit

|         | s | vv |extra|         |    |
|---------|---|----|-----|---------|----|
|primitive|`s`|`00`|     |         |    |
|         |`s`|`00`|`00` |inf/NaN  |    |
|         |`s`|`00`|`01` |bool     |    |
|         |`s`|`00`|`10` |nullish  |    |
|short str|`s`|`01`|     |         |    |
|         |`0`|`01`|`00` |`""`     |`0` |
|         |`0`|`01`|`01` |`1x16`   |`16`|
|         |`0`|`01`|`10` |`2x16`   |`32`|
|         |`1`|`01`|`00` |`4x7`    |`28`|
|         |`1`|`01`|`01` |`5x7`    |`35`|
|         |`1`|`01`|`10` |`6x7`    |`42`|
|short str|`s`|`1_`|     |         |    |
|         |`0`|`10`|     |`3x16`   |`48`|
|         |`0`|`11`|     |`8x6`    |`48`|
|         |`1`|`1_`|     |`7x7`    |`49`|

### Ptr

- `s` - is static;
- `vv` - data type: `object`, `string`, `bigint`, `function`.

### Short BigInt

- `s` - sign;
- `vvv` - 3 high bits of `uint51`.

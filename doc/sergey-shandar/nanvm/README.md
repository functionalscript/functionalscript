# Low Level

## Structure

- `1` bit: `s` sign
- `11` bits: `x` exponent
- `52` bits: `v` fraction

## NaN and Infinities

When exponent `x` is `0b_111_1111_1111`.

Three special values:

- Infinity: `0x7FF0_0000_0000_0000`,
- Neg. Infinity: `0xFFF0_0000_0000_0000`,
- NaN: `0x7FF0_0000_0000_0001`.

Format:

```
s111_1111_1111_vvvv
vvvv_vvvv_vvvv_vvvv
vvvv_vvvv_vvvv_vvvv
vvvv_vvvv_vvvv_vvvv
```

The sign `s` and fraction `v`: 53 bits = 0x35 bits

|                         |                        |
|-------------------------|------------------------|
|`s111_1111_1111_00vv_...`|primitives and short str|
|`s111_1111_1111_01vv_...`|pointer                 |
|`s111_1111_1111_1vvv_...`|short bigint            |

### Primitives and Short Strings

`s-00vv` + 48 bit

|         | s | vv |extra|         |    |
|---------|---|----|-----|---------|----|
|primitive|`_`|`00`|     |         |    |
|         |`_`|`00`|`00` |inf,NaN  |    |
|         |`0`|`00`|`01` |bool     |    |
|         |`0`|`00`|`10` |null     |    |
|         |`0`|`00`|`11` |undefined|    |
|short str|`_`|`01`|     |         |    |
|         |`0`|`01`|`00` |`""`     |`0` |
|         |`0`|`01`|`01` |`1x16`   |`16`|
|         |`0`|`01`|`10` |`2x16`   |`32`|
|         |`1`|`01`|`00` |`4x7`    |`28`|
|         |`1`|`01`|`01` |`5x7`    |`35`|
|         |`1`|`01`|`10` |`6x7`    |`42`|
|short str|`_`|`1_`|     |         |    |
|         |`0`|`10`|     |`3x16`   |`48`|
|         |`0`|`11`|     |`8x6`    |`48`|
|         |`1`|`1_`|     |`7x7`    |`49`|

### Ptr

- `s` - is static;
- `vv` - data type: `object`, `string`, `bigint`, `function`.

### Short BigInt

- `s` - sign;
- `vvv` - 3 high bits of `uint51`.

```rust
const PRIMITIVE : u64 = 0x7FFF_C000_0000_0000;

const NON_FINITE: u64 = 0x7FF0_0000_0000_0000;
const INF       : u64 = 0x7FF0_0000_0000_0000;
const NEG_INF   : u64 = 0xFFF0_0000_0000_0000;
const NAN       : u64 = 0x7FF0_0000_0000_0001;

const BOOL      : u64 = 0x7FF0_4000_0000_0000;
const FALSE     : u64 = 0x7FF0_4000_0000_0000;
const TRUE      : u64 = 0x7FF0_4000_0000_0001;

const NULLISH   : u64 = 0x7FF0_C000_0000_0000;

const NULL      : u64 = 0x7FF0_8000_0000_0000;
const UNDEFINED : u64 = 0x7FF0_C000_0000_0000;

fn is_finite(a: u64) -> bool {
  a & 0x7FF0_0000_0000_0000 != 0x7FF0_0000_0000_0000
}

fn is_number(a: u64) -> bool {
  // is_finite(a) || (a & PRIMITIVE == NON_FINITE)
  a & 0x7FFF_C000_0000_0000 <= 0x7FF0_0000_0000_0000
}

fn is_bool(a: u64) -> bool {
  a & PRIMITIVE == 0x7FF0_4000_0000_0000
}

fn is_short_string(a: u64) -> bool {
  (a & 0x7FFC_0000_0000_0000) == 0x7FF0_0000_0000_0000 &&
  (a & 0x0003_0000_0000_0000) != 0
}

fn is_ptr(a: u64) -> bool {
  a & 0x7FFC_0000_0000_0000 == 0x7FF4_0000_0000_0000
}

const SHORT_BIGINT: u64 = 0x7FF8_0000_0000_0000

fn is_short_bigint(a: u64) -> bool {
  a & SHORT_BIGINT == SHORT_BIGINT
}
```

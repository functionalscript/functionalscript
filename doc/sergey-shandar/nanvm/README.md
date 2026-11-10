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
- NaN: `0x7FF8_0000_0000_0000`.

## Special Tags

Format:

```
s111_1111_1111_vvvv
vvvv_vvvv_vvvv_vvvv
vvvv_vvvv_vvvv_vvvv
vvvv_vvvv_vvvv_vvvv
```

- `s111_1111_1111_..._vv00` non-finite numbers, primitives and short string (scalars)
- `s111_1111_1111_..._vv10` reference
- `s111_1111_1111_..._vvv1` short bigint

## Non-Finite Numbers, Primitives, and Short Strings (scalars)

`s111_1111_1111...vvvv_vv00`

|               |Cap.|            |States|
|---------------|----|------------|------|
|`....0000_0000`|`44`|non-finite  |`3`   |
|`....0001_0000`|`44`|boolean     |`2`   |
|`0...0010_0000`|`44`|undefined   |`1`   |
|`0...0011_0000`|`44`|null        |`1`   |
|`0...0000_1000`|`44`|empty string|`1`   |
|`0...0001_1000`|`44`|`1x16`      |`2^16`|
|`0...0010_1000`|`44`|`2x16`      |`2^32`|
|`0...0100_1000`|`44`|`4x7`       |`2^28`|
|`0...0101_1000`|`44`|`5x7`       |`2^35`|
|`0...0110_1000`|`44`|`6x7`       |`2^42`|
|`0........0100`|`48`|`3x16`      |`2^48`|
|`0........1100`|`48`|`8x6`       |`2^48`|
|`1.........100`|`49`|`7x7`       |`2^49`|

## Reference

`s111_1111_1111_tttt_....10`

- `s` is static,
- `tttt` is type.

## Examples

```rust
#[repr(transparent)]
pub struct Type(u8)

const NUMBER_TYPE    : u8 = 0x0;
const BOOLEAN_TYPE   : u8 = 0x1;
const UNDEFINED_TYPE : u8 = 0x2;
const OBJECT_TYPE    : u8 = 0x3;
const STRING_TYPE    : u8 = 0x4;
const BIGINT_TYPE    : u8 = 0x5;
const FUNCTION_TYPE  : u8 = 0x6;

impl Type {
    const NUMBER: Self    = Self(NUMBER_TYPE);
    const BOOLEAN: Self   = Self(BOOLEAN_TYPE);
    const UNDEFINED: Self = Self(UNDEFINED_TYPE);
    const OBJECT: Self    = Self(OBJECT_TYPE);
    const STRING: Self    = Self(STRING_TYPE);
    const BIGINT: Self    = Self(BIGINT_TYPE);
    const FUNCTION: Self  = Self(FUNCTION_TYPE);
    
    const fn new(v: u8) -> Self {
        Self(v & 0xF)
    }
}

//

#[repr(transparent)]
pub struct Any(u64);

//

const EXP          : u64 = 0x7FF0_0000_0000_0000;

// TAG 8:

const TAG8         : u64 = 0x7FF0_0000_0000_00FF;

const NON_FINITE   : u64 = 0x7FF0_0000_0000_0000;

const INFINITY     : u64 = 0x7FF0_0000_0000_0000;
const NEG_INFINITY : u64 = 0xFFF0_0000_0000_0000;
const NAN          : u64 = 0x7FF8_0000_0000_0000;

const BOOL         : u64 = 0x7FF0_0000_0000_0010;

const FALSE        : u64 = 0x7FF0_0000_0000_0010;
const TRUE         : u64 = 0xFFF0_0000_0000_0010;

const UNDEFINED    : u64 = 0x7FF0_0000_0000_0020;
const NULL         : u64 = 0x7FF0_0000_0000_0030;

const EMPTY_STRING : u64 = 0x7FF0_0000_0000_0008;

// TAG 2:

const TAG2         : u64 = 0x7FF0_0000_0000_0003;

const SCALAR       : u64 = 0x7FF0_0000_0000_0000;
const REF          : u64 = 0x7FF0_0000_0000_0002;

const REF_TAG      : u64 = 0xFFF0_0000_0000_0003;
const DYN_REF      : u64 = 0x7FF0_0000_0000_0002;

// TAG 1:

const SHORT_BIGINT : u64 = 0x7FF0_0000_0000_0001;

impl Any {

    pub const INFINITY: Self = Self(INFINITY);
    pub const NEG_INFINITY: Self = Self(NEG_INFINITY);
    pub const NAN: Self = Self(NAN);
    pub const FALSE: Self = Self(FALSE);
    pub const TRUE: Self = Self(TRUE);
    pub const UNDEFINED: Self = Self(UNDEFINED);
    pub const NULL: Self = Self(NULL);
    pub const EMPTY_STRING: Self = Self(EMPTY_STRING);

    pub fn is_finite(&self) -> bool {
        (self.0 & EXP) != EXP
    }

    pub fn is_number(&self) -> bool {
        self.is_finite() || self.0 & TAG8 == NON_FINITE
    }

    pub fn is_bool(&self) -> bool {
        self.0 & TAG8 == BOOL
    }

    pub fn is_short_string(&self) -> bool {
        self.0 & TAG2 == SCALAR &&
        self.0 & 0xC != 0
    }

    pub fn is_ref(&self) -> bool {
        self.0 & TAG2 == REF
    }

    pub fn is_dyn_ref(&self) -> bool {
        self.0 & REF_TAG == DYN_REF
    }

    pub fn is_short_bigint(&self) -> bool {
        self.0 & SHORT_BIGINT == SHORT_BIGINT
    }

    pub fn typeof_(&self) -> Type {
        if self.is_finite() { return NUMBER_TYPE; }
        if self.0 & 1 == 1 { return BIGINT_TYPE; }
        // reference
        if self.0 & 2 == 2 { return Type::new(self.0 >> 48); }
        // scalar
        if self.0 & 0xC != 0 { return STRING_TYPE; }
        Type::new(self.0 >> 4)
    }
}

impl Clone for Any {
    fn clone(&self) -> Self {
        if self.is_dyn_ref() {
            self.add_ref();
        }
        Self(self.0)
    }
}

impl Drop for Any {
    fn drop(&mut self) {
        if self.is_dyn_ref() {
            self.release();
        }
    }
}
```

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

- `s111_1111_1111_vttt_..._vp00` values and pointers `sv: 50`,
- `s111_1111_1111_vvvv_..._vv10` short string `sv: 51`,
- `s111_1111_1111_vvvv_..._vvv1` short bigint. `sv: 52`.

## Types

|     |           |options     |total|values              |
|-----|-----------|------------|-----|--------------------|
|`000`|`number`   |`v`         |1    |`Inf`, `-Inf`, `NaN`|
|`001`|`undefined`|`v`         |2    |`undefined`         |
|`010`|`boolean`  |`v`         |3    |`false`, `true`     |
|`011`|`object`   |`v`,`p`,`sp`|6    |`null`, `{}`        |
|`100`|`string`   |   ,`p`,`sp`|8    |                    |
|`101`|`bigint`   |   ,`p`,`sp`|10   |                    |
|`110`|`function` |`v`,`p`,`sp`|13   |                    |
|`111`|`array`    |`v`,`p`,`sp`|16   |`[]`                |

## Non-Finite Numbers, Primitives

`s111_1111_1111...vvvv_0000`

|         |`s`|`ttt`|States|
|---------|---|-----|------|
|number   |   |`000`|`3`   |
|boolean  |   |`001`|`2`   |
|undefined|   |`010`|`1`   |
|object   |   |`011`|`2`   |
|array    |   |`100`|`1`   |
|string   |   |`101`|`0`   |
|bigint   |   |`110`|`0`   |
|function |   |`111`|`0`   |

For function we can have three functions

- returns an arg array,
- returns the first argument (identity),
- throws (panic).

Additional native functions such as `Object.is`, `structEq`, etc.

## Short String 51 bit

Short string using a leading `...01`.
Max length is 8 characters.

|      |    |Offset|Occupied|
|------|----|------|--------|
|`1x16`|`16`|      |`17`    |
|`2x16`|`32`|      |`31`    |
|`3x16`|`48`|      |`49`    |
|      |    |      |        |
|`4x7` |`28`|      |`29`    |
|`5x7` |`35`|      |`36`    |
|`6x7` |`42`|      |`43`    |
|`7x7` |`49`|      |`50`    |
|      |    |      |        |
|`8x6` |`48`|`2`   |`51`    |

## Reference

`s111_1111_1111_tttt_...r10` - non function reference type

- `s` is static,
- `tttt` is type:
  - `string`
  - `bigint`
  - `object`
  - `array`
  - `function`
- `r` = `0` reserved.

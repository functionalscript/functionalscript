# The 23 NaN-box patterns of the layout check

2026-11-11. A companion to
[type-system.md](./type-system.md#how-it-is-checked),
which says that a prototype ran the layout check on 23 patterns. This file
lists them.

The 23 are the variants of the note's `any`
([Layout](./type-system.md#layout)),
with the ones that its code block leaves to a comment written out. The one
variant that is missing is `number`, which takes a float's own bits and has
no pattern. There are 13 scalars and short values, and 10 references. All
are in the notation of the
[NaN VM README](../../sergey-shandar/nanvm/README.md).

## How to read a pattern

- `0` and `1` are fixed bits, and `_` is a separator.
- A letter is one bit of a field: `b` is a boolean, `u` the units of a
  short string, `v` the value of a short bigint, and `p` a pointer.
- `…` repeats the character before it. `0…0` is as many zeros as the 64
  bits leave, and `u…u` fills the field up to the width of its type.
- Every pattern starts with a sign bit and an exponent of eleven ones, so
  no value of it is a finite number.
- The lowest bits choose the family, as in the README's "Special Tags":
  `00` is a scalar, `10` is a reference, and `1` is a short bigint.

## Scalars and short values: 13 patterns

Rows 1 to 12 are the README's scalar table from its second row down, in
the README's order. Row 13 is its short bigint.

| # | Variant | Pattern | What it holds |
| --- | --- | --- | --- |
| 1 | `boolean` | `b111_1111_1111_0…0_0001_0000` | `false` and `true`. `b` is the sign bit, as in the README's `FALSE` and `TRUE`. |
| 2 | `undefined` | `0111_1111_1111_0…0_0010_0000` | One value, the README's `UNDEFINED`. |
| 3 | `null` | `0111_1111_1111_0…0_0011_0000` | One value, the README's `NULL`. Its `typeof_` is 3, the object type, as in JavaScript. |
| 4 | `string.empty` | `0111_1111_1111_0…0_0000_1000` | The empty string, the README's `EMPTY_STRING`. |
| 5 | `string.s1x16` | `0111_1111_1111_0…0_u…u_0001_1000` | A string of one UTF-16 code unit. `u` is 16 bits. |
| 6 | `string.s2x16` | `0111_1111_1111_0…0_u…u_0010_1000` | Two UTF-16 code units. `u` is 32 bits. |
| 7 | `string.s4x7` | `0111_1111_1111_0…0_u…u_0100_1000` | Four 7-bit units, which is four ASCII characters. `u` is 28 bits. |
| 8 | `string.s5x7` | `0111_1111_1111_0…0_u…u_0101_1000` | Five ASCII characters. `u` is 35 bits. |
| 9 | `string.s6x7` | `0111_1111_1111_0…0_u…u_0110_1000` | Six ASCII characters. `u` is 42 bits. |
| 10 | `string.s3x16` | `0111_1111_1111_u…u_0100` | Three UTF-16 code units. The tag is 4 bits here, which leaves `u` the 48 bits it needs. |
| 11 | `string.s8x6` | `0111_1111_1111_u…u_1100` | Eight 6-bit units. Each unit is an index into a table of 64 characters. `u` is 48 bits. |
| 12 | `string.s7x7` | `1111_1111_1111_u…u_100` | Seven ASCII characters. The tag is the sign bit and 3 low bits, which leaves `u` 49 bits. |
| 13 | `bigint.short` | `v111_1111_1111_v…v_1` | A bigint that fits a signed 52-bit integer. `v` is the sign bit and the 51 bits above the tag. |

- In rows 4 to 9 the low byte is the tag. Its upper four bits are the
  string's length, which is 0, 1, 2, 4, 5 or 6, and its lower four are
  `1000`.
- Where the units are narrower than the README's "Cap." for the row, the
  bits above them are 0.
- The README's first row, "non-finite", is not in the list. Infinity,
  -Infinity and NaN are numbers, so they belong to `number`.

## References: 10 patterns

All ten have the README's reference format, `s111_1111_1111_tttt_....10`.

- `tttt` is the kind of the object.
- `p` is 46 bits wide. It is the address without its two alignment bits,
  so a 4-aligned address of up to 48 bits fits.
- `heap` has `s` = 0. It is a counted reference to an object on the heap,
  the note's `ref(O)`, and `dup` and `drop` change its count.
- `lit` has `s` = 1. It is a reference to an object made at compile time,
  the note's `stat(O)`, and nothing counts it.

| # | Variant | Pattern | What it holds |
| --- | --- | --- | --- |
| 14 | `object.heap` | `0111_1111_1111_0011_p…p_10` | A counted pointer to an object. `0011` is the README's `OBJECT_TYPE`. |
| 15 | `object.lit` | `1111_1111_1111_0011_p…p_10` | A static pointer to an object. |
| 16 | `string.heap` | `0111_1111_1111_0100_p…p_10` | A counted pointer to a string with no short form. `0100` is `STRING_TYPE`. |
| 17 | `string.lit` | `1111_1111_1111_0100_p…p_10` | A static pointer to such a string. |
| 18 | `bigint.heap` | `0111_1111_1111_0101_p…p_10` | A counted pointer to a bigint that is too wide for the short form. `0101` is `BIGINT_TYPE`. |
| 19 | `bigint.lit` | `1111_1111_1111_0101_p…p_10` | A static pointer to such a bigint. |
| 20 | `function.heap` | `0111_1111_1111_0110_p…p_10` | A counted pointer to a function. `0110` is `FUNCTION_TYPE`. |
| 21 | `function.lit` | `1111_1111_1111_0110_p…p_10` | A static pointer to a function. |
| 22 | `array.heap` | `0111_1111_1111_0111_p…p_10` | A counted pointer to an array. `0111` is a tag that the note adds. |
| 23 | `array.lit` | `1111_1111_1111_0111_p…p_10` | A static pointer to an array. |

## The fixed bits, in hex

A value `x` is in a pattern when `x & mask == value`. The value is also
the pattern's smallest member, the one whose field bits are all 0.

| # | Variant | Field bits | Mask | Value |
| --- | --- | --- | --- | --- |
| 1 | `boolean` | 1 | `0x7FFF_FFFF_FFFF_FFFF` | `0x7FF0_0000_0000_0010` |
| 2 | `undefined` | 0 | `0xFFFF_FFFF_FFFF_FFFF` | `0x7FF0_0000_0000_0020` |
| 3 | `null` | 0 | `0xFFFF_FFFF_FFFF_FFFF` | `0x7FF0_0000_0000_0030` |
| 4 | `string.empty` | 0 | `0xFFFF_FFFF_FFFF_FFFF` | `0x7FF0_0000_0000_0008` |
| 5 | `string.s1x16` | 16 | `0xFFFF_FFFF_FF00_00FF` | `0x7FF0_0000_0000_0018` |
| 6 | `string.s2x16` | 32 | `0xFFFF_FF00_0000_00FF` | `0x7FF0_0000_0000_0028` |
| 7 | `string.s4x7` | 28 | `0xFFFF_FFF0_0000_00FF` | `0x7FF0_0000_0000_0048` |
| 8 | `string.s5x7` | 35 | `0xFFFF_F800_0000_00FF` | `0x7FF0_0000_0000_0058` |
| 9 | `string.s6x7` | 42 | `0xFFFC_0000_0000_00FF` | `0x7FF0_0000_0000_0068` |
| 10 | `string.s3x16` | 48 | `0xFFF0_0000_0000_000F` | `0x7FF0_0000_0000_0004` |
| 11 | `string.s8x6` | 48 | `0xFFF0_0000_0000_000F` | `0x7FF0_0000_0000_000C` |
| 12 | `string.s7x7` | 49 | `0xFFF0_0000_0000_0007` | `0xFFF0_0000_0000_0004` |
| 13 | `bigint.short` | 52 | `0x7FF0_0000_0000_0001` | `0x7FF0_0000_0000_0001` |
| 14 | `object.heap` | 46 | `0xFFFF_0000_0000_0003` | `0x7FF3_0000_0000_0002` |
| 15 | `object.lit` | 46 | `0xFFFF_0000_0000_0003` | `0xFFF3_0000_0000_0002` |
| 16 | `string.heap` | 46 | `0xFFFF_0000_0000_0003` | `0x7FF4_0000_0000_0002` |
| 17 | `string.lit` | 46 | `0xFFFF_0000_0000_0003` | `0xFFF4_0000_0000_0002` |
| 18 | `bigint.heap` | 46 | `0xFFFF_0000_0000_0003` | `0x7FF5_0000_0000_0002` |
| 19 | `bigint.lit` | 46 | `0xFFFF_0000_0000_0003` | `0xFFF5_0000_0000_0002` |
| 20 | `function.heap` | 46 | `0xFFFF_0000_0000_0003` | `0x7FF6_0000_0000_0002` |
| 21 | `function.lit` | 46 | `0xFFFF_0000_0000_0003` | `0xFFF6_0000_0000_0002` |
| 22 | `array.heap` | 46 | `0xFFFF_0000_0000_0003` | `0x7FF7_0000_0000_0002` |
| 23 | `array.lit` | 46 | `0xFFFF_0000_0000_0003` | `0xFFF7_0000_0000_0002` |

## What the check did with them

1. **Width.** Each pattern expands to exactly 64 bits, and each field is
   as wide as its type.
2. **Not a number.** Every value of every pattern is a NaN other than the
   canonical one, `0x7FF8_0000_0000_0000`. So no pattern can hold a finite
   number, an infinity or the one NaN that `f64c` has.
3. **No overlap.** Each of the 253 pairs has a bit that is fixed in both
   patterns and differs.
4. **The README's constants.** `FALSE`, `TRUE`, `UNDEFINED`, `NULL` and
   `EMPTY_STRING` are in their patterns. Infinity, -Infinity, NaN, 1.0, 0
   and -0 are in none.
5. **The counted test.** The five `heap` patterns merge into one test,
   `x & 0xFFF8_0000_0000_0003 == 0x7FF0_0000_0000_0002`, and no other
   variant passes it. No reference has a `tttt` with its top bit set, so
   the test can drop that bit. What is left is
   `x & 0xFFF0_0000_0000_0003 == 0x7FF0_0000_0000_0002`: the README's
   `REF_TAG` and `DYN_REF`, the two constants of `is_dyn_ref`.
6. **Samples.** Both ends of each pattern and 2,000 random values of it
   are in that pattern alone. The README's `typeof_` returns the expected
   type for each: 1 for a boolean, 2 for undefined, 3 for null and an
   object, 4 for a string, 5 for a bigint, 6 for a function, and 7 for an
   array.
7. **The `is_*` functions.** The README's seven `is_*` functions agree
   with the patterns on the same values. This check was added on
   2026-11-11, together with this list. The sentence in the note covers
   checks 2, 3, 5 and 6.

Checks 1 to 5 are exact, because they work on masks. Checks 6 and 7 are
samples, 46,046 values in all.

## What is not from the README

- **The array tag, `0111`.** The README's type constants end at 6, the
  function, and it has no array. With this tag its `typeof_` returns 7
  for an array, a type that the README has no constant for.
- **The meaning of the short bigint's bits.** The README gives the
  pattern, `…vvv1`. That the 52 other bits are one signed integer whose
  sign is the box's sign bit is the note's reading.
- **The pointer field.** The README writes dots between `tttt` and `10`.
  The note reads them as one field of 46 bits, the address without its
  alignment bits.
- **Where the units of a short string sit.** The README gives each row
  its tag and its capacity. The prototype puts the units right above the
  tag and zeros above the units.
- **The 64 characters of a 6-bit unit.** The README does not list them.
  [optimal-nanvm.md](../../../nanvm/lib/todo/optimal-nanvm.md#6-bit-id-string)
  has one such table: `$`, `0` to `9`, `A` to `Z`, `_`, `a` to `z`.
- **The names.** `heap` and `lit` are the note's names for the two values
  of the README's `s` bit. `s1x16` to `s8x6` are the README's `1x16` to
  `8x6` with a letter in front. In the note's tree, `string.s3x16` is
  `any.string.short.s3x16`, and `string.heap` is `any.string.long.heap`.

## Running it

The check is [`nan-box-patterns.check.py`](./nan-box-patterns.check.py),
next to this file: a Python script of about 260 lines that prints the
patterns bit by bit, the hex table above and the seven results. Run it
with `python3 -I nan-box-patterns.check.py`. It is a prototype. Step 3 of
the note's plan builds the real layout checker, and its proof is this same
comparison with the README.

[nan-box-in-ir.md](./nan-box-in-ir.md) goes further: the same 23 patterns
written in the note's eDSL, in one piece and by module, with functions
over them.

# Synthetic Universal Language (SUL)

SUL is a universal encoding that bijectively maps any finite sequence of symbols to a single root symbol via a balanced tree, from which the original sequence can be uniquely recovered.

## Concepts

- A **symbol** is an element of a level's finite alphabet `[0, n)`.
- A **word** is a finite sequence of symbols that encodes into a single symbol of the next level.
- A **level** defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level.

## Levels

While SUL can work with any finite alphabet size `n`, this implementation constrains `n = 2^e + 1` for a non-negative integer exponent `e`. The first three levels for a tree starting with a binary alphabet are:

| `e` | `n`    |
|-----|--------|
| `0` | `2`    |
| `2` | `5`    |
| `7` | `0x81` |

## Word structure

A valid word has the form `[s0, s1, ..., sk, t]` where:

- `s0 > s1 > ... > sk` — a strictly decreasing prefix of at least one symbol
- `t >= sk` — a terminating symbol no less than the last prefix element

The minimum word length is 2: one prefix symbol is required to provide a value to compare against `t`, and the length requirement ensures each word collapses to a single symbol at the next level — so the sequence strictly shrinks at every step and converges to a single root symbol in a finite number of levels.

For example, with `n = 5`: `[3, 1, 0, 2]` is valid (`3 > 1 > 0`, `2 >= 0`), but `[3, 1, 0]` is not
(the sequence must terminate with `t >= 0`, i.e. it cannot end at `0` without a final symbol).

## Encoding

A valid word encodes to a single symbol of the next level.

### Level 1 (`n = 2`) example

Level 1 accepts binary symbols (bits) `{0, 1}` as input.

| Word    | Level 2 symbol |
|---------|----------------|
| `0,0`   | `0`            |
| `0,1`   | `1`            |
| `1,0,0` | `2`            |
| `1,0,1` | `3`            |
| `1,1`   | `4`            |

### Level 2 (`n = 5`) example

| Word    | Level 3 symbol |
|---------|----------------|
| `0,0`   | `00`           |
| `0,4`   | `04`           |
| `1,0,0` | `05`           |
| `1,1`   | `0a`           |
| `4,4`   | `80`           |

### Level 3 (`n = 0x81`) example

The output alphabet (level 4) has size `n = 2^136 + 1`.

| Word       | Level 4 symbol                                |
|------------|-----------------------------------------------|
| `00,00`    | `000_0000_0000_0000_0000_0000_0000_0000_0000` |
| `00,01`    | `000_0000_0000_0000_0000_0000_0000_0000_0001` |
| `00,80`    | `000_0000_0000_0000_0000_0000_0000_0000_0080` |
| `01,00,00` | `000_0000_0000_0000_0000_0000_0000_0000_0081` |
| `80,7f,80` | `0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF` |
| `80,80`    | `100_0000_0000_0000_0000_0000_0000_0000_0000` |

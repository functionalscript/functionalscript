# Synthetic Universal Language (SUL)

SUL is a universal encoding that bijectively maps any finite sequence of symbols to a single root symbol via a balanced tree, from which the original sequence can be uniquely recovered.

## Concepts

- A **symbol** is an element of a level's finite alphabet `[0, n)`.
- A **word** is a finite sequence of symbols that encodes into a single symbol of the next level.
- A **level** defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level.

## Levels

Each level is parameterized by `e`, where the alphabet size is `n = 2^e + 1`. The first three levels for a tree starting with a binary alphabet are:

| `e` | `n`    |
|-----|--------|
| `0` | `2`    |
| `2` | `5`    |
| `7` | `0x81` |

## Word structure

A valid word has the form `[s0, s1, ..., sk, t]` where:

- `s0 > s1 > ... > sk` — a strictly decreasing prefix (may be empty, giving a length-2 word)
- `t >= sk` — a terminating symbol no less than the last prefix element

For example, with `n = 5`: `[3, 1, 0, 2]` is valid (`3 > 1 > 0`, `2 >= 0`), but `[3, 1, 0]` is not (the sequence must terminate with `t >= 0`, i.e. it cannot end at `0` without a final symbol).

## Encoding

A valid word encodes to a single symbol of the next level.

### Level 1 (`n = 2`) example

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

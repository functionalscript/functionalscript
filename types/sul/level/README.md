# SUL Levels

A **level** defines a finite alphabet and a bijection between valid words over that alphabet and symbols of the next level. SUL uses two distinct kinds of levels: literal and hash.

## Literal levels

The first three levels use an exact integer bijection. Alphabet sizes grow via tetration starting from `n = 2`:

| Level | `e` | `n = 2^e + 1` |
|-------|-----|---------------|
| 1     | `0` | `2`           |
| 2     | `2` | `5`           |
| 3     | `7` | `0x81`        |

Level 4 would have `2^136 + 1` symbols — far too large for integer storage.

See [literal/README.md](literal/README.md) for encoding details, tables, and streaming API.

## Hash level

Beyond level 3, each symbol is a 256-bit content-addressed [`Id`](../id/README.md). Any pair of identifiers merges into a new identifier via a SHA2-based `compress`, enabling unbounded nesting at a fixed size. The hash level array grows dynamically as encoding proceeds.

See [hash/README.md](hash/README.md) for the encoding algorithm and streaming API.

## Word structure

All levels share the same word structure. A valid word has the form `[s0, s1, ..., sk, t]` where:

- `s0 > s1 > ... > sk` — a strictly decreasing prefix
- `sk <= t` — a terminating symbol no less than the last prefix element

See the [SUL overview](../README.md) for full details.

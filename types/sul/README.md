# Synthetic Universal Language (SUL)

SUL is a universal encoding that bijectively maps any finite sequence of symbols to a single root symbol via a balanced tree, from which the original sequence can be uniquely recovered.

## Concepts

- A **symbol** is an element of a level's finite alphabet `[0, n)`.
- A **word** is a finite sequence of symbols that encodes into a single symbol of the next level.
- A **level** defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level, where `n = 2^e + 1`.

## Levels

Each level is parameterized by `e`, where the alphabet size is `n = 2^e + 1`. The first three levels for a tree starting with a binary alphabet are:

| `e` | `n`    |
|-----|--------|
| `0` | `2`    |
| `2` | `5`    |
| `7` | `0x81` |

## Encoding

A word `[s0, s1, ..., sk]` over a level's alphabet encodes to a single symbol of the next level. The encoding is order-preserving: all words starting with `s0` are grouped together, and within that group sorted by the remaining sub-word.

### Level 1 (`n = 2`) example

| Word  | Symbol |
|-------|--------|
| `0,0` | `0`    |
| `0,1` | `1`    |
| `1,0,0` | `2`  |
| `1,0,1` | `3`  |
| `1,1` | `4`    |

### Level 2 (`n = 5`) example

| Word    | Symbol |
|---------|--------|
| `0,0`   | `00`   |
| `0,4`   | `04`   |
| `1,0,0` | `05`   |
| `1,1`   | `0a`   |
| `4,4`   | `80`   |

## API

```ts
import { level, wordEqual, wordToString, symbolToString } from './module.f.ts'

const l = level(2n)          // n = 5
const sym = l.encode([1n, 0n, 2n])  // → 7n
const word = l.decode(7n)           // → [1n, 0n, 2n]
```

### `level(e)`

Creates a `Level` for alphabet size `n = 2^e + 1`.

### `Level.encode(word)`

Converts a valid word of symbols into a symbol of the next level.

### `Level.decode(symbol)`

Inverse of `encode`: restores the complete word from a symbol.

### `Level.sum(i)`

Cumulative count of all words whose first symbol is less than `i`. Used internally by `encode` and `decode`.

### `symbolToString(s)`

Formats a symbol as a hex string.

### `wordToString(word)`

Formats a word as a comma-separated hex string, e.g. `"1,0,2"`.

### `wordEqual`

Curried equality for two words: `wordEqual(a)(b)`.

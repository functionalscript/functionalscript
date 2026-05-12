# Compression

Adaptive arithmetic encoding.

- A dictionary with frequencies (a number of items). A sum of all frequencies equals to a number of symbols in the sequence.
  - symbol: frequency (integer)
- An arithmetic sequence.

## Example

`Hello world!`

|     |   |Total|
|-----|---|-----|
| `H` | 1 |   1 |
| `e` | 1 |   2 |
| `l` | 3 |   5 |
| `o` | 2 |   7 |
| ` ` | 1 |   8 |
| `w` | 1 |   9 |
| `r` | 1 |  10 |
| `d` | 1 |  11 |
| `!` | 1 |  12 |

```
- `H` => /12 *1
- `e` => /11 *1
- `l` => /10 *3
- `l` => /9  *2
- `o` => /8  *2
- ` ` => /7  *1
- `w` => /6  *1
- `o` => /5  *1
- `r` => /4  *1
- `l` => /3  *1
- `d` => /2  *1
- `!` => /1  *1
```

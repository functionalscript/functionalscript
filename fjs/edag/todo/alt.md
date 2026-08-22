# Alternative Definition of EDAG

Two forms:

1. Full expressions `[o, a, b]`
2. Partial expression `[o, b]`

where `o` is either:
- `.`,
- `()`,
- `?.`,
- `?.()`.

Partial expressions are used inside `?.` and `?.()`

- `a?.b`: `['?.', a, b, []]`
- `a?.b.c`: `['?.', a, b, [['.', c]]]`
- `(a?.b)(...c)`: `['()', ['?.', a, b], c]`
- `a?.b(...c)`: `['?.', a, b, [['()', c]]]`

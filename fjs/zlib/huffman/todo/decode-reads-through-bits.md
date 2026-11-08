## `decode` reads a bit by hand

**Priority:** P5
**Status:** open

### Problem

[`module.f.js`](../module.f.js) imports `read` from
[`bits`](../../bits/module.f.js) and uses it for one-bit reads in
`nextLengths`, `read(input, pos, 1)`. `decode` reads the same one bit
inline:

```js
const byte = input[Number(at >> 3)]
if (byte === undefined) { return more }
bits |= byte >> (at & 7) & 1
```

"The bit at `at`, or `more`" has two owners in one directory.

### Proposal

`decode` reads `const bit = read(input, at, 1); if (bit === more) { return
more }; bits |= bit`, and the index and shift arithmetic goes.

### Tasks

- [ ] `decode` over `read`; the suite under `fjs/zlib`.

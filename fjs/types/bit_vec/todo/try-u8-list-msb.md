## try-u8-list-msb. The fallible MSB byte-list binding is re-bound in three modules

**Priority:** P5
**Status:** open

### Problem

This module pre-binds MSB — "the byte order of every byte-oriented
format in this repository" — for `u8ListToVecMsb` and `u8ListMsb`, but
not for the form that answers `null` on overflow, so each consumer binds
it under a local name:

```js
// fjs/text                      // fjs/types/uint8array           // fjs/git/oid
const tryU8ListToVecMsb = tryU8ListToVec(msb)                       const toVec = tryU8ListToVec(msb)
```

`uint8array`'s `listToVec` then unwraps it with its own panic message,
which is `u8ListToVecMsb` — already `mapUnwrap` over the same binding —
with different words.

### Proposal

```ts
export const tryU8ListToVecMsb: (list: List<number>) => Nullable<Vec>
```

here, with `u8ListToVecMsb` defined as its unwrap; the three modules
import it, and `uint8array.listToVec` composes `u8ListToVecMsb` unless
its message is deliberate, in which case its doc says why.

### Tasks

- [ ] The export; the three importers; `tsc`, `fjs test`.

### Related

- [../../../text/todo/190-text-code-unit-string-boundary.md](../../../text/todo/190-text-code-unit-string-boundary.md)
  — cites the same move, shipped for `listToVec`, as precedent.

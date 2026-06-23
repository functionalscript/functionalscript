# TODO

## Derive `concat` from `join('')`

**Priority:** P5
**Status:** open

`concat` and `join` are the same fold modulo a separator — `concat` is exactly `join('')`:

```ts
// current
export const concat: Reduce<string> = i => acc => `${acc}${i}`

// proposed
export const concat: Reduce<string> = join('')
```

Worth doing if the file is touched anyway, not on its own.

### Tasks

- [ ] Replace `concat`'s body with `join('')`.
- [ ] Confirm `proof.f.ts` still passes and `npx tsc` is clean.

---

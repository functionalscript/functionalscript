## Lift JS lexical predicates out of `emergent_testing`

**Priority:** P4
**Status:** open

`fjs/emergent_testing/module.f.ts` carries four predicates (`isAlpha`, `isDigit`, `isInteger`, `isIdentifier`) that encode JavaScript lexical rules, not test logic. They are even exported from the test module, polluting its public surface.

Create `fjs/js/identifier/module.f.ts` with `isInteger` and `isIdentifier` (private `isAlpha`/`isDigit`), and have `emergent_testing` import them instead.

```ts
// fjs/js/identifier/module.f.ts
const isAlpha = (c: string): boolean =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_' || c === '$'

const isDigit = (c: string): boolean => c >= '0' && c <= '9'

/** Returns `true` if `s` is a non-negative decimal integer without a leading zero. */
export const isInteger = (s: string): boolean =>
    s.length > 0 && [...s].every(isDigit) && (s === '0' || s[0] !== '0')

/** Returns `true` if `s` is a valid JS identifier (ASCII subset: `[A-Za-z_$][A-Za-z0-9_$]*`). */
export const isIdentifier = (s: string): boolean =>
    s.length > 0 && isAlpha(s[0]) && [...s.slice(1)].every(c => isAlpha(c) || isDigit(c))
```

A future consumer: the DJS serializer currently quotes every object key; with `isIdentifier` it could emit `{a: 5}` instead of `{"a": 5}` for identifier keys.

### Tasks

- [ ] Create `fjs/js/identifier/module.f.ts` with the two exports.
- [ ] Add co-located `proof.f.ts` with 100% coverage (reuse cases from `fjs/emergent_testing/proof.f.ts:313-328`).
- [ ] Register in `deno.json` `exports` map.
- [ ] Remove the four definitions from `fjs/emergent_testing/module.f.ts`; repoint `emergent_testing/proof.f.ts` at the new module.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- `fjs/js/tokenizer` — `rangeIdStart`/`rangeId` are the code-point twin of these string predicates; a candidate for a future shared source of truth.

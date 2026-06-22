# TODO

## Formatter for `.f.js` and `.f.ts` files

**Priority:** P3
**Status:** open

Find or build a formatter that handles `.f.js` and `.f.ts` files correctly.

---

## Investigate eslint-config-jessie

**Priority:** P3
**Status:** open

See [eslint-config-jessie](https://github.com/Agoric/eslint-config-jessie).

---

## Detect unexported types referenced by exported types

**Priority:** P5
**Status:** open

TypeScript doesn't show an error if an exported type references a non-exported type:

```ts
type A = number
export type B = A | string
```

We need to find a way to detect such cases. Notes:

- FunctionalScript doesn't have RegEx, so an ad-hoc text-scan in `.f.ts` is not possible.
- Requires emitting `.d.ts` via `tsc` and inspecting the output (or driving the TypeScript Compiler API) — an external tool, not a FunctionalScript module.
- The proper place for this check is a FunctionalScript parser, which is not available yet.

---

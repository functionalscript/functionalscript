# 40. Detect unexported types referenced by exported types.

**Priority:** P5
**Status:** open

TypeScript doesn't show an error if an exported type references a non-exported type. We need to find a way to detect such cases.

```ts
type A = number
export type B = A | string
```

Notes:
- FunctionalScript doesn't have RegEx, so an ad-hoc text-scan implementation in `.f.ts` is not possible.
- The task is more about an external tool: it requires emitting `.d.ts` via `tsc` and inspecting the output (or driving the TypeScript Compiler API), neither of which belongs inside a FunctionalScript module.
- The proper place for this check is a FunctionalScript parser, which is not available yet.
- Low priority (P5).

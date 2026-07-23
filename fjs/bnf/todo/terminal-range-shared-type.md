## Define `TerminalRange` once, shared between `bnf` and `bnf/data`

**Priority:** P4
**Status:** open

### Problem

The same public type is declared in two modules. `fjs/bnf/module.f.ts:23`:

```ts
export type TerminalRange = number
```

and `fjs/bnf/data/module.f.ts:25-27`:

```ts
/**
 * The same as the functional TerminalRange.
 */
export type TerminalRange = number
```

The `bnf/data` comment literally says "The same as the functional
TerminalRange". `bnf/data` already re-imports the range *codec* primitives
(`oneEncode`, `rangeDecode`) from `bnf`, so it depends on `bnf` anyway — yet it
redeclares the type instead of importing it. One concept, two public
declarations that must stay in lockstep (e.g. if the packed representation ever
changes from a plain `number`).

### Proposal

Define `TerminalRange` once in `fjs/bnf/module.f.ts` (the module that owns the
range encode/decode primitives) and have `fjs/bnf/data/module.f.ts` import and
re-export it rather than redeclaring. Per `AGENTS.md`: "When a sibling module
already has the type you need, import it" instead of duplicating.

### Tasks

- [ ] Import `TerminalRange` from `bnf` in `bnf/data`; remove the local
      redeclaration (re-export if external consumers of `bnf/data.TerminalRange`
      exist).
- [ ] Run `npx tsc` and `fjs t`; confirm `bnf` and `bnf/data` proofs still pass.

### Related

- `fjs/bnf/todo/669-bnf-data-shared-helpers.md` — other `bnf/data` DRY cleanups
  (different functions; this type duplication is not covered there).

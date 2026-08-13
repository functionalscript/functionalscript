## Define `TerminalRange` once, shared between `bnf` and `bnf/data`

**Priority:** P4
**Status:** open

### Problem

The same public type is declared in two modules. `fjs/bnf/types.ts:30`:

```ts
export type TerminalRange = number
```

and `fjs/bnf/data/types.ts:11-14`:

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

Define `TerminalRange` once in `fjs/bnf/types.ts` (the module that owns the
range encode/decode primitives' types) and have `fjs/bnf/data/types.ts` import
and re-export it rather than redeclaring. Per `AGENTS.md`: "When a sibling
module already has the type you need, import it" instead of duplicating.

### Tasks

- [ ] Import `TerminalRange` from `bnf` in `bnf/data`; remove the local
      redeclaration (re-export if external consumers of `bnf/data.TerminalRange`
      exist).
- [ ] Run `npx tsc` and `fjs t`; confirm `bnf` and `bnf/data` proofs still pass.

### Related

- [669-bnf-matcher-shared-core](./669-bnf-matcher-shared-core.md) — the same
  one-owner move for the matcher backends' cursor, AST, and result
  constructors (different declarations; this type duplication is not covered
  there).

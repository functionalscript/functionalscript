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

Define `TerminalRange` once, in **the module that owns the range encode/decode
primitives' types**, and have every other module import it rather than
redeclare. Per `AGENTS.md`: "When a sibling module already has the type you
need, import it" instead of duplicating.

That principle picked `fjs/bnf/types.ts` when the front end still held the
codec, and this issue originally named it. It is the wrong owner:
`fjs/bnf/data` would then depend on the classical front end permanently, and
the dependency would not survive that front end's deletion. The same is
already true of `fjs/bnf/descent/types.ts`, which imports the type from
`../types.ts` today.

[ebnf-migration](../../todo/ebnf-migration.md) extracts the codec into
`fjs/ebnf/terminal/`, which is what the principle actually points at. **The
owner is `terminal/`**, and this issue is a step of that plan's stage 1
rather than a separate change.

### Tasks

- [ ] Move `TerminalRange` to `fjs/ebnf/terminal/types.ts` with the codec
      ([ebnf-migration](../../todo/ebnf-migration.md) stage 1).
- [ ] Remove the redeclaration in `bnf/data/types.ts` and the front-end import
      in `bnf/descent/types.ts`; import from `terminal/` in both. **No
      re-export from `data`**, even if external consumers of
      `bnf/data.TerminalRange` exist: `bnf/data` is deleted with `bnf/`, and
      [ebnf-migration](../../todo/ebnf-migration.md) allows no compatibility
      re-exports. Those consumers are updated in the same breaking change, as
      AGENTS.md §5 requires.
- [ ] Run `tsc` and `fjs t`; confirm the `bnf`, `bnf/data`, and `bnf/descent`
      proofs still pass.

### Related

- [ebnf-migration](../../todo/ebnf-migration.md) — settles the owner as
  `fjs/ebnf/terminal/` and implements this in its stage 1; its dependency
  direction cannot hold while the front end owns this type.
- [`fjs/bnf/matcher`](../matcher) — the same one-owner move, done, for the
  matcher backends' cursor, AST, and result constructors. It covers different
  declarations; this type duplication was explicitly out of its scope and is
  still open.

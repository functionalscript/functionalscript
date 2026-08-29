## State the chain grammar's containment instead of copying it

**Priority:** P4
**Status:** open

### Problem

`OptionPropertyLambda` extends `OptionLambda` by three productions — the
grammar's own docs describe the states as nested — but the four shared
productions are spelled out by copy, six times:

- `../types.ts:98-102` (`OptionLambda`) and `:111-118`
  (`OptionPropertyLambda`) each list
  `['|()', Exp] | ['|()', Exp, OptionLambda] | ['|.', Index] |
  ['|.', Index, OptionPropertyLambda]` in full;
- `../module.f.mjs:271-276` (`_optionLambda`) and `:311-320`
  (`_optionPropertyLambda`) repeat the same four as runtime `or` operands;
- the two thunks' JSDoc `@type` tuples (`:264-269`, `:301-309`) repeat them
  a fifth and sixth time.

`PropertyLambda`'s arms (`../types.ts:89-92`) likewise all reappear inside
`OptionPropertyLambda`. Adding or changing a step means editing six lists in
lockstep, with nothing but review catching a list that was missed.

### Proposal

Express the containment once per layer:

- `types.ts`:
  `export type OptionPropertyLambda = OptionLambda | readonly['|?.()', Exp]
  | readonly['|?.()', Exp, OptionLambda] | readonly['|!()', Exp]` — a pure
  rewrite, the union is identical.
- `module.f.mjs`: a shared thunk of the four common productions spread into
  both `or`s. The productions reference `optionPropertyLambda` and
  `optionLambda`, which is why `_optionLambda` is already a thunk — the
  shared piece stays one for the same TDZ reason. The JSDoc `@type` tuples
  can then spread a named common-segment type instead of re-listing it,
  keeping the `Phantom` pins intact.

  That name may **not** be a file-scope `@typedef` in `module.f.mjs` —
  `fjs/AGENTS.md` forbids one in any authored `.mjs`. It goes in
  `../types.ts` beside the unions it mirrors (it is reached by the shipped
  `Phantom` declarations, so it belongs to the public closure; give it a `_`
  prefix if judged private) and is pulled in with `@import`. Inlining
  `ReturnType<typeof _commonProductions>` in both annotations is the
  alternative if a name reads like overhead.

If the `@type`/`Phantom` plumbing resists the spread cleanly, the `types.ts`
half alone is still worth landing: it is where a reader checks what the
states admit, and it is the copy most likely to drift silently.

### Tasks

- [ ] Rewrite `OptionPropertyLambda` (and, if it reads well,
      `PropertyLambda`'s overlap) through `OptionLambda` in `../types.ts`.
- [ ] Share the four common productions between `_optionLambda` and
      `_optionPropertyLambda` in `../module.f.mjs`, JSDoc included — with the
      common-segment type in `../types.ts` or inlined, never as a file-scope
      `@typedef` in the `.mjs`.
- [ ] `npx tsc`, `fjs t`; the edag schema proofs pass unchanged.

### Related

- [property-lambda-subset.md](./property-lambda-subset.md) — the VM-side
  copy of the same containment.
- `../../../todo/edag-spec.md` — forbids duplicating EDAG definitions into
  `fjs/djs/`; this is the same principle applied inside `fjs/edag/` itself.

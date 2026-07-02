## data-tosequence-reuse. `bnf/data` re-implements `toSequence`

**Priority:** P5
**Status:** open

### Problem

`fs/bnf/module.f.ts:104-107` exports the string → terminal-range-sequence
conversion:

```ts
const mapOneEncode = map(oneEncode)
export const toSequence = (s: string): readonly TerminalRange[] =>
    toArray(mapOneEncode(stringToCodePointList(s)))
```

`fs/bnf/data/module.f.ts:102,104-107` redeclares `mapOneEncode` and inlines
the identical expression:

```ts
const mapOneEncode = map(oneEncode)
const data = (dr: DataRule): NewRule => {
    switch (typeof dr) {
        case 'string': {
            return sequence(toArray(mapOneEncode(stringToCodePointList(dr))))
```

`bnf/data` already imports `oneEncode` from `../module.f.ts`, so it depends
on that module anyway — it re-imports the primitive and re-derives the
composite instead of importing the composite.

### Proposal

Import `toSequence` in `fs/bnf/data/module.f.ts`, replace the `'string'`
case body with `sequence(toSequence(dr))`, and delete the local
`mapOneEncode` (and the then-unused `stringToCodePointList`/`map` imports if
nothing else uses them).

### Tasks

- [ ] Replace the inline expression with `toSequence`; drop the duplicate
      helper and any now-unused imports.
- [ ] `npx tsc`, `fjs t`.

### Related

- `AGENTS.md` — "When a sibling module already has the type or helper you
  need, import it."

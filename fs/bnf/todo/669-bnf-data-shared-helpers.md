## 669-bnf-data-shared-helpers. Hoist and share repeated helpers in `bnf/data`

**Priority:** P4
**Status:** open

### Problem

`fs/bnf/data/module.f.ts` carries a DRY / hoisting smell in its parser
machinery, not covered by the existing fold-children work in
[i665-bnf-data-fold-children](todo.md) (that issue is
about the `sequence` / `variant` AST-fold helpers, a different pair of
functions).

(A second smell used to be listed here — duplicated `emptyTagMapAdd` branches
in `fs/bnf/descent` — but that function was deleted and replaced by a single
shared `emptyTagMap` fixpoint in `fs/bnf/data/module.f.ts` while fixing
nullable-analysis-shared, so it no longer applies.)

#### 1. `mrSuccess` / `mrFail` match-result constructors

Both `descentParser` (lines 384-385) and `parserRuleSet` (lines 452-453) define
a local pair of match-result constructors *inside* their recursive `f`
callback:

```ts
// descentParser, inside f (383-385)
const mrSuccess = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, true, idx]
const mrFail    = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, false, idx]

// parserRuleSet, inside f (452-453)
const mrSuccess = (tag: AstTag, sequence: AstSequence, r: Remainder): MatchResult => [{tag, sequence}, true, r]
const mrFail    = (tag: AstTag, sequence: AstSequence, r: Remainder): MatchResult => [{tag, sequence}, false, r]
```

Two problems:

- **Hoisting.** These helpers capture no local state — they are pure functions
  of their arguments — yet they are redeclared on *every* recursive call of `f`.
  `AGENTS.md` says: "Hoist helpers to module scope when they don't capture local
  state — don't redeclare them inside another function on every call."
- **DRY.** All four constructors are the same shape: `[{ tag, sequence },
  success, third]`. They differ only in the type of the third tuple element
  (`number` index vs `Remainder`) and the sequence type — both of which a
  generic parameter captures.

### Proposal

**Hoist a single match-result constructor** to module scope, generic over the
sequence and third-element types, and derive `mrSuccess` / `mrFail` (or call
it directly with the success flag) in both parsers:

```ts
const mr = <S, R>(success: boolean) =>
    (tag: AstTag, sequence: S, r: R): readonly [{ readonly tag: AstTag, readonly sequence: S }, boolean, R] =>
        [{ tag, sequence }, success, r]
```

`descentParser` uses `mr<AstSequenceMeta<T>, number>`; `parserRuleSet` uses
`mr<AstSequence, Remainder>`. Both `f` bodies drop their four local
declarations.

This is a local, single-module refactor with no cross-module coordination.

### Tasks

- [ ] Hoist the shared `mr` constructor to module scope; update both `f` bodies.
- [ ] Run `npx tsc`, `fjs t`, and confirm `fs/bnf/data/proof.f.ts` still passes
      with full coverage.

### Related

- [i665-bnf-data-fold-children](todo.md) — the adjacent
  `sequence` / `variant` AST-fold extraction (different functions, same module).
- [i667-bnf-repeat-flatten](todo.md) — other `bnf/data`
  cleanups.

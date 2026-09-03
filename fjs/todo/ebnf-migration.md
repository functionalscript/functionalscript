## ebnf-migration. Build `fjs/ebnf/` beside `fjs/bnf/`, then retire `bnf/`

**Priority:** P3
**Status:** open

An alternative to [grammar-bucket](./grammar-bucket.md). The two plans reach
the same end state — one front end with a repetition primitive, one reference
backend, no classical `bnf/` — by different routes, and only one of them is to
be followed. This one is proposed as the replacement; adopting it marks
grammar-bucket `irrelevant` (stage 0 below).

### Problem

[grammar-bucket](./grammar-bucket.md) moves the live `fjs/bnf/` module in eight
stages so that a second front end can share its machinery, and only then builds
the second front end. Read against
[ebnf-front-end](../bnf/todo/ebnf-front-end.md), most of that work exists to let
two front ends coexist over one set of shared modules:

- the dependency inversion (stages 1, 3, 4) genericizes the transformer protocol
  and `GrammarData` over a rule identity so that neutral code names no front
  end;
- the pre-stage-5 proof split rewrites the backend proofs against `RuleSet`
  literals so the classical front end can be deleted from under them
  (ebnf-front-end Problem 2);
- `classic` / `deterministic` become duplicated local fixtures so stage 8 does
  not break them;
- one alphabet adapter has to return two representations, because both front
  ends are alive for the whole port (ebnf-front-end Problem 9), and that gates
  stage 2 and so the whole plan;
- every stage moves a public path, so every stage is a breaking change against
  a module that is in use throughout.

None of that buys anything once the second front end is a separate module that
the first one may depend on. And the plan also assumes that everything under
`bnf/` survives the migration, which is not the intent: some of it is to be
rethought, and some retires without an EBNF counterpart.

### Proposal

#### Principles

1. **`fjs/ebnf/` is a new module, not a rename.** There is no `fjs/grammar/`.
   The neutral machinery lives inside `ebnf/` under the same names it has
   today (`data/`, `matcher/`, `ll1/`, `token_symbol/`), which is what
   grammar-bucket wanted from a bucket and what `bnf/` already does.
2. **Dependency direction: `bnf` may import from `ebnf`; `ebnf` never imports
   from `bnf`.** In any form — a runtime `import`, a JSDoc `@import`, an
   `import type` in `types.ts`, or a relative link in a README or `todo/`. A
   type-only dependency is exactly what would make `tsc` fail when `bnf/` is
   deleted, so it counts. The rule is enforced mechanically (stage 0), not by
   review.
3. **Triage, not copy.** Every piece of `bnf/` is assigned one of three bins
   before it is touched: **move** (relocated, `bnf` repoints to it),
   **rewrite** (a new implementation in `ebnf/`, designed rather than copied),
   or **retire** (stays in `bnf/` and is deleted with it, no EBNF counterpart).
   The tables below are that assignment.

   **This migration is an opportunity to improve BNF, and nothing is copied
   blindly.** Everything is subject to rethinking on its way into `ebnf/`:
   names, algorithms, types, module boundaries, proofs. A **move** bin means
   the behaviour is worth keeping, not that the code is; the developer moving
   it is expected to read it as if reviewing it for the first time, and to
   rename, simplify or re-type what does not hold up. Where the rethinking
   turns a move into a rewrite, update the table rather than the other way
   round. The design questions ebnf-front-end leaves open are the first such
   opportunity, not the last.
4. **`bnf/` stays live.** Minor additions to the front end, the `lib/`
   grammars, helpers and proofs may land in `bnf/`, in `ebnf/`, or in both
   while EBNF is built — writing the same thing twice is how EBNF's advantages
   and pitfalls surface. The one restriction is by layer: a change to machinery
   that `ebnf/` has already taken over (the IR, `matcher/`, `ll1/`,
   `token_symbol/`) lands in `ebnf/` first and is back-ported only when a
   `bnf/` consumer needs it. Otherwise every backend fix is paid twice for the
   whole fork, and the copy that survives is the one it should have been paid
   for.
5. **Compare, in proofs.** `descentEquivalence` in `bnf/ll1/proof.f.mjs` pins
   one grammar and one expected AST, matched by two backends. The same shape
   across front ends — one grammar spelled in `bnf` and in `ebnf`, lowered to
   the same `RuleSet` or matched to the same AST — is the strongest evidence
   the EBNF design can get, and it doubles as the port checklist: a grammar
   whose two spellings agree is ready to move.
6. **One backend: layered LL(1) with AST mapping.** The recursive-descent
   backend retires. Every consumer, the `fjs/djs` tokenizer and parser
   included, ports to the LL(1) backend composed in layers as
   [layered-parser](../bnf/todo/layered-parser.md) describes, with AST mapping
   through the transformer protocol. Where a consumer's grammar depends on
   backtracking today, the port changes the grammar.

#### Layout

```text
fjs/ebnf/
  module.f.mjs, types.ts   the front end: Rule union with a repetition primitive
  terminal/                TerminalRange, EOF, the codec            (move)
  unicode/                 text adapter: str, set, range, notOf, …   (rewrite)
  data/                    RuleSet IR with bounded Repeat, emptyTagMap (rewrite)
  matcher/                 cursor, EOF, AST, transformer tools       (move)
  ll1/                     the reference backend                     (rewrite)
  token_symbol/            multi-character token alphabet            (move)
  map/                     AST-mapping types and the rtti map        (move / rewrite)
  lib/                     json, datajs                              (port)
  todo/
```

The front end itself is the design in
[ebnf-front-end](../bnf/todo/ebnf-front-end.md): the `Rule` union following
RTTI, `repeat(min, max)` with `option` / `repeat0Plus` / `repeat1Plus` / `times`
as partial applications, the AST as a function of the form, `BoundedArray` from
`fjs/types/array`. Its Problems 1, 3, 6, 7 and 8 are about the IR and the AST
and still need answers here. Problems 2 and 9 exist only because of shared
machinery and do not.

#### Module triage

| `bnf/` today | bin | in `ebnf/` |
|---|---|---|
| `module.f.mjs` — constructors, `Rule` union | rewrite | `module.f.mjs`, `types.ts`, per ebnf-front-end |
| `module.f.mjs` — `rangeEncode`, `rangeDecode`, `oneEncode`, `eof`, `fullRange` | move | `terminal/`; `bnf` repoints |
| `module.f.mjs` — `str`, `set`, `range`, `not`, `notSet`, `remove`, `unicodeRange`, `unicodeMax` | rewrite | `unicode/`, EBNF forms only ([unicode-rules](../bnf/todo/unicode-rules.md)) |
| `data/` — `RuleSet`, `emptyTagMap`, `isRepeat` | rewrite | `data/` with a bounded `Repeat` carrying `min`/`max`; keeps a spelling for `0..Infinity` so `bnf`'s `toData` output stays a valid rule set, and `bnf/data` repoints its IR types and `emptyTagMap` to it |
| `data/` — `toData`, `toDataWithRules`, `detectRepeat`, `repeatItem`, `GrammarData`, `RuleNameMap` | retire | the front-end lowering in `ebnf/` needs no recognition; a hand-written or deserialized set uses the primitive |
| `matcher/` | move | `Rule` identity in the transformer protocol retargeted to the EBNF `Rule`; `bnf` keeps its own copy of the identity-keyed pieces (`Entry.rule`, the repeat arm) if a type parameter is not enough |
| `ll1/` | rewrite | the reference backend: `RuleSet`-only entry, layer composition, per-layer metadata per [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md), AST mapping; a first/first conflict names the rule |
| `descent/` | retire | consumers port to `ll1/` (below) |
| `token_symbol/` | move | the layer boundary; imports `unicode/` |
| `map/types.ts` | move | |
| `map/rtti/` | rewrite | tests the shape directly, no `repeatItem`; absorbs [rename-check-map](../bnf/map/rtti/todo/rename-check-map.md) |
| `lib/json`, `lib/datajs` | port | one PR for both; `commaJoin0Plus` changes the AST of both bracket pairs |
| `testlib.f.mjs` — `showAst` and the root `private.ts` typing it | move | backend-neutral; needed by `ll1`'s proofs |
| `testlib.f.mjs` — `classic`, `deterministic` | retire | `ebnf/lib` is its own fixture |
| `README.md` | split | the AST contract, "Terminals and EOF", "Dispatch" go to `ebnf/` and its owners; the functional representation stays and dies with `bnf/` |

Each **move** deletes the `fjs/bnf/…` path in the same PR — there are no
compatibility re-exports — so that PR declares `**BREAKING CHANGES:**` in its
`Changelog:` section ([changelog/RELEASE.md](../../changelog/RELEASE.md)). No
consumer outside `fjs/bnf` and `fjs/djs` imports those paths.

#### Consumer port

Outside `fjs/bnf` the front end has exactly five consumers, all under
`fjs/djs`. In dependency order:

1. `bnf/lib/json` and `bnf/lib/datajs` — atomically, since `testlib`'s
   `deterministic()` delegates to `lib/json`.
2. `fjs/djs/tokenizer` — depends on `terminal/`, `unicode/`, `data/`, `ll1/`.
3. `fjs/djs/parser` — the above plus `token_symbol/`.

**Neither djs grammar is LL(1) as spelled.** Checked by running both through
`dispatchMap`; the innermost conflicting rule in each, found by building the
dispatch map of each rule's closure (more may surface once these are fixed):

| grammar | rules | conflicting rule | nature |
|---|---|---|---|
| `djs/parser` | 91 | the statement terminator, `{ semicolon, newline }` | both branches begin with trivia; the comment above it says the `;` branch *rewinds* to the newline one, a backtracking design |
| `djs/tokenizer` | 167 | the punctuator variant: `=`, `==`, `===`, `=>`, `!`, `!=`, `>>>=`, … | shared prefixes: maximal munch, which [layered-parser](../bnf/todo/layered-parser.md) names as the one mechanism a token layer adds over recognition |

So the djs port is a grammar rewrite plus a backend swap, not a swap alone.
The parser conflict is resolved by left-factoring the trivia prefix or by
pushing the decision into the token layer so the parser sees one lookahead
symbol; the tokenizer conflict by left-factoring the literal list into a prefix
tree, which a helper can build from the list, or by a token layer that munches
maximally. Both are where EBNF's `option` as a bounded repeat with a flat AST
gets its first real test, so they belong in the comparison proofs before the
consumers move.

#### Issue triage

`fjs/bnf/todo/` holds twenty-two issues and `fjs/bnf/map/rtti/todo/` one. An
issue goes where the code it describes goes, and one that describes only
retired code retires with it. Moved issues have their `descent` references
rewritten against the surviving backend as they move.

| issue | bin | destination |
|---|---|---|
| [ebnf-front-end](../bnf/todo/ebnf-front-end.md) | absorb | its design becomes `fjs/ebnf/README.md` as stage 1 ships; its open Problems 1, 3, 6, 7, 8 move to `ebnf/todo/` if still open then |
| [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md) | close | implemented by `terminal/` (stage 1) |
| [unicode-rules](../bnf/todo/unicode-rules.md) | move | `ebnf/unicode/todo/` until stage 4 implements it |
| [rule-visitor](../bnf/todo/rule-visitor.md), [665-bnf-data-fold-children](../bnf/todo/665-bnf-data-fold-children.md) | absorb | inputs to the `data/` rewrite (stage 2) |
| [042-mixing-serializable-bnfs](../bnf/todo/042-mixing-serializable-bnfs.md) | move | `ebnf/data/todo/` |
| [bigint-symbols](../bnf/todo/bigint-symbols.md), [terminal-range-representation](../bnf/todo/terminal-range-representation.md), [eof-as-ordinary-symbol](../bnf/todo/eof-as-ordinary-symbol.md) | move | `ebnf/terminal/todo/` |
| [utf8-token-symbols](../bnf/todo/utf8-token-symbols.md), [tokens-with-extra-information](../bnf/todo/tokens-with-extra-information.md) | move | `ebnf/token_symbol/todo/` |
| [207-bnf-semantic-actions](../bnf/todo/207-bnf-semantic-actions.md), [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md), [layered-parser](../bnf/todo/layered-parser.md), [043-stateful-parser](../bnf/todo/043-stateful-parser.md), [parser-structure](../bnf/todo/parser-structure.md) | move | `ebnf/todo/` — they describe the reference backend and its protocol |
| [recognizer-backend](../bnf/todo/recognizer-backend.md), [032-stupid-parser](../bnf/todo/032-stupid-parser.md), [046-lr1-parser](../bnf/todo/046-lr1-parser.md) | move | `ebnf/todo/` — backends that do not exist yet, created at their final paths |
| [proof-recognizer-and-fixtures](../bnf/todo/proof-recognizer-and-fixtures.md), [serialized-proof-expectations](../bnf/todo/serialized-proof-expectations.md) | move | `ebnf/todo/`, rewritten for one backend |
| [bnf-grammar-single-owner](../bnf/todo/bnf-grammar-single-owner.md) | move | `ebnf/lib/todo/` at stage 5 |
| [rename-check-map](../bnf/map/rtti/todo/rename-check-map.md) | absorb | the `map/rtti` rewrite |
| [grammar-bucket](./grammar-bucket.md) | supersede | `irrelevant` at stage 0, deleted at stage 7; the "Later candidates" bullet of [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md) is rewritten to name this plan and `fjs/ebnf/` |

#### Stages

Every stage is additive except the moves it names and the last one, and
`tsc` and `fjs t` pass at each. Stages 1 to 4 can overlap; 5 waits on 1 to 4;
6 on 5; 7 on 6.

0. **Adopt.** Mark grammar-bucket `irrelevant` with a pointer here. Add the
   boundary check: a CI step that fails when anything under `fjs/ebnf/` names
   `bnf/` in an import, an `@import`, an `import type`, or a link. Add one
   sentence to [fjs/AGENTS.md](../AGENTS.md) stating the direction.
1. **`ebnf/terminal/` and the front end.** Move the codec with its proof cases;
   `bnf` repoints. Land `ebnf/types.ts` and `ebnf/module.f.mjs` per
   ebnf-front-end, recording the answers to Problems 1, 3, 6, 7 and 8 in
   `ebnf/README.md` as they are made. `BoundedArray` comes from
   [#1865](https://github.com/functionalscript/functionalscript/pull/1865).
2. **`ebnf/data/`.** The IR with a bounded `Repeat`, `emptyTagMap`, and the
   lowering from the EBNF front end. `bnf/data` repoints its IR types and
   `emptyTagMap` here — the first `bnf → ebnf` edge — and keeps `toData`,
   `detectRepeat` and `repeatItem` as its own.
3. **`ebnf/matcher/`, `ebnf/token_symbol/`, `ebnf/ll1/`.** Move the first two;
   `bnf` repoints. Rewrite `ll1` against the new IR: flat nodes for every
   bound, a conflict error that names the rule, metadata and AST mapping per
   the moved issues.
4. **`ebnf/unicode/` and `ebnf/map/`.** The text adapter in EBNF forms; the
   mapping types moved; the rtti map rewritten without `repeatItem`, with its
   co-located proof.
5. **`ebnf/lib/` and the comparison proofs.** Port `json` and `datajs` in one
   PR. Add the cross-front-end proof group: each `lib/` grammar in both
   spellings, same `RuleSet` where the constructors are shape-preserving, same
   AST otherwise, with the differences ebnf-front-end predicts pinned
   explicitly (`option`, `repeat1Plus`, `commaJoin0Plus`).
6. **Layered LL(1) and the djs port.** The token layer with maximal munch or
   the left-factoring helper; the two conflicts above resolved in the grammars;
   `djs/tokenizer` then `djs/parser` on `ebnf/ll1/`. The first grammar to leave
   `descent` is the first evidence the backend decision holds; if it does not,
   this stage is where the plan is revised, not forced.
7. **Delete `fjs/bnf/`.** With it: the retired issues, `descentEquivalence` in
   its two-backend form, and the classical half of the README split. Finish
   the issue moves, rewrite the group-fs bullet, delete grammar-bucket. One
   `**BREAKING CHANGES:**` declaration.

### Tasks

- [ ] Stage 0: grammar-bucket to `irrelevant`; the boundary check in CI; the
      direction sentence in `fjs/AGENTS.md`.
- [ ] Stage 1: `ebnf/terminal/` with proof; `ebnf/types.ts` and
      `ebnf/module.f.mjs` with proof; answers to ebnf-front-end Problems 1, 3,
      6, 7, 8 in `ebnf/README.md`; close terminal-range-shared-type.
- [ ] Stage 2: `ebnf/data/` with bounded `Repeat` and proof; `bnf/data`
      repointed; rule-visitor and 665 absorbed or moved.
- [ ] Stage 3: `ebnf/matcher/` and `ebnf/token_symbol/` moved with proofs;
      `ebnf/ll1/` rewritten with proof; `showAst` moved to a neutral testlib.
- [ ] Stage 4: `ebnf/unicode/` and `ebnf/map/` with proofs; unicode-rules and
      rename-check-map settled.
- [ ] Stage 5: `ebnf/lib/json` and `ebnf/lib/datajs` with proofs; the
      cross-front-end comparison proof group; bnf-grammar-single-owner moved.
- [ ] Stage 6: the token layer; the djs tokenizer and parser grammars made
      LL(1); both ported; the descent backend without consumers.
- [ ] Stage 7: delete `fjs/bnf/`; move the remaining issues; split the README;
      rewrite the group-fs bullet; delete grammar-bucket. `**BREAKING
      CHANGES:**`.
- [ ] `tsc`, `fjs t` at every stage; every new `.f.mjs` ships 100% co-located
      proof coverage ([fjs/AGENTS.md](../AGENTS.md)).

### Related

- [grammar-bucket](./grammar-bucket.md) — the plan this replaces; kept until
  stage 7 for its rationale on what is neutral and what is not.
- [ebnf-front-end](../bnf/todo/ebnf-front-end.md) — the front-end design this
  plan builds at stage 1; its Problems 2 and 9 dissolve here.
- [layered-parser](../bnf/todo/layered-parser.md),
  [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md),
  [207-bnf-semantic-actions](../bnf/todo/207-bnf-semantic-actions.md) — what
  the reference backend grows into at stages 3 and 6.
- [unicode-rules](../bnf/todo/unicode-rules.md) — stage 4, EBNF representation
  only.
- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — its "Later candidates" bullet names `fjs/grammar/`, which this plan does
  not create.

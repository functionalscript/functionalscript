## grammar-bucket. Group the grammar modules under `fjs/grammar/`

**Priority:** P3
**Status:** open

### Problem

`fjs/bnf/` holds two things under one name. A **functional front end**:
`module.f.mjs`, `types.ts`, `map/rtti/`, and the `lib/` grammars. And
**front-end-neutral machinery** that only ever sees the serializable `RuleSet`:
the IR, `emptyTagMap`, the shared `matcher/`, the `ll1/` and `descent/`
backends, `token_symbol/`.

[group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
already lists a "tooling bucket" as a later candidate. **grammar** is the
better name: it has a crisp membership rule, and it is what the module is
about.

The split matters now because a second front end is coming
([ebnf-front-end](../bnf/todo/ebnf-front-end.md)), and it cannot share the
neutral machinery today, because that machinery imports the front end:

- `data/` takes `oneEncode` from it, and hosts `toData` — the conversion
  *from* the functional layer — beside the IR.
- `matcher/` takes `eofSymbol`; `ll1/` and `descent/` take `rangeDecode` and
  `toData`, and each exports a convenience entry taking a functional rule.
- `token_symbol/` takes `fullRange`, `rangeDecode` and `unicodeRange`.
- **Type-level, and deepest:** `matcher/types.ts` spreads the functional
  `Rule` through the transformer protocol (`Entry.rule`,
  `TransformerMap.entries`, `Transformer`'s repeat arm,
  `TransformerTools.entry`/`repeatOf`), and `data/types.ts` does the same via
  `RuleNameMap` and `GrammarData`. Moving runtime code alone would leave a
  second front end unable to type-check against them.
- A second coupling, to the **alphabet** rather than the front end:
  `matcher/types.ts:10`, `ll1/types.ts:7` and `descent/types.ts:12` import
  `CodePoint` and spell their public surfaces `Meta<M, CodePoint>`, so a
  backend over token symbols already contradicts its own types.

### Proposal

#### Layout

```text
fjs/grammar/
  terminal/      TerminalRange, RangeVariant, the symbol type, and the codec
  data/          RuleSet IR, emptyTagMap, detectRepeat   → terminal
  matcher/       cursor, EOF, AST, transformer tools     → data, terminal
  ll1/           backend over RuleSet only               → matcher, data, terminal
  descent/       backend over RuleSet only               → matcher, data, terminal
  token_symbol/  multi-character token alphabet          → terminal, unicode
  map/           AST-level mapping types                 → matcher
  unicode/       str, set, range, notSet, toSequence, …  → terminal
  byte/          binary alphabet, when it exists         → terminal
  bnf/           classical front end                     → data, unicode
  ebnf/          front end with a repetition primitive   → data, unicode
  lib/           example grammars                        → a front end
  recognizer/, dfa/  new backends, when they land        → data
```

**Membership:** a module belongs here iff it defines, transforms or executes
grammars over a symbol alphabet. `fsc` is a compiler and `js/tokenizer` a
hand-written scanner: both are consumers and stay out, as does `djs`. Where
those three end up is not this plan's business; that they are not grammars is.

**Dependency:** nothing below a front end imports one. The alphabet adapters
are *dependencies* of the front ends, not parts of them, so they outlive the
classical one.

`terminal/` owns `TerminalRange` and `RangeVariant`, not just the codec.
[terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md) names
the front end as owner, which would make `data → bnf` permanent; its own
principle — the owner is whichever module owns the range primitives' types —
picks `terminal/` once the codec lands there, and stage 1 repoints and
implements it.

#### Sequencing: one public path change per API

Directory paths are the public API here, so each change is breaking. Doing the
inversion "in place" would move `terminal/` and `toData` twice. So the
inversions that are type- or signature-only move no path and go first; the two
stages that relocate an API go straight to the final path.

1. **`fjs/grammar/terminal/`** — extract the alphabet-neutral codec directly to
   its final path, with `TerminalRange`, `RangeVariant`, the backends' symbol
   type, `eofSymbol` / `eof`, and `fullRange`: `matcher`, `ll1`, `descent`
   and `token_symbol` all read from that set today, and stage 8 deletes the
   module they read it from. Point them and `data` at it. Closes
   `terminal-range-shared-type`.
2. **`fjs/grammar/unicode/`** — the alphabet split
   ([unicode-rules](../bnf/todo/unicode-rules.md)), at its final path, with
   `byte/` beside it if needed by then. It has to be here, not late:
   `token_symbol` uses `unicodeRange`, so until this exists it cannot be
   pointed away from the front end. **Its public shape depends on
   [ebnf-front-end](../bnf/todo/ebnf-front-end.md)'s Problem 9** — one adapter
   must serve both front ends, which want different representations — so
   answer that before building this. That is a design answer, not an
   implementation: `ebnf-front-end` is blocked on stages 1-5 for its *code*,
   and its open questions can be settled at any time.
3. **Genericize** the transformer protocol over the rule identity in
   `matcher/types.ts`, and `RuleNameMap<R>` / `GrammarData<R>` in
   `data/types.ts`. Generic over `R` they name no front end, so `data/` stays
   neutral and the stage-4 builder has a neutral input. Types only.
4. **Backends over `RuleSet` only.** `parserRuleSet` and
   `descentParserRuleSet` stay; `transformers` takes the grammar data.
   `parser(fr)` and `descentParser(fr)` are front-end wrappers in the wrong
   module: they stay put here and move once, in stage 5.
5. **`fjs/grammar/bnf/`** — move the front end and carry `toData`,
   `toDataWithRules`, `data/private.ts`, the classical `GrammarData`
   instantiation and `repeatItem` into it in the same change, plus the two
   wrappers. The front end is `module.f.mjs`, `types.ts`, `proof.f.mjs`,
   `testlib.f.mjs` and `map/rtti/` — but **not** the AST renderer inside
   `testlib.f.mjs`. `showAst` and the root `private.ts` that types it are
   backend-neutral and are what `ll1/proof.f.mjs` and `descent/proof.f.mjs`
   assert with, so they go to the surviving neutral testlib instead; only the
   grammar-bearing `classic` / `deterministic` travel with the front end.
   `fjs/bnf/README.md` is **split**, not moved: the AST contract and node
   shape go to a new `fjs/grammar/README.md`, "Terminals and EOF" to
   `terminal/`, "Dispatch" to `ll1/`, and only the functional representation
   travels with the front end. Repoint its inbound links, including the ones
   in these two issues.
6. **The neutral modules** — `data/`, `matcher/`, `ll1/`, `descent/`,
   `token_symbol/`, `map/` — one PR each, in any order.
7. **`fjs/grammar/lib/`**, then `fjs/grammar/ebnf/`.
8. Port the consumers to `ebnf` in the order
   [ebnf-front-end](../bnf/todo/ebnf-front-end.md) gives, then delete
   `fjs/grammar/bnf/`. `detectRepeat` and `unicode/` stay.

**Before stage 5**, rewrite the backend proofs against `RuleSet` literals:
`ll1/proof.f.mjs:14`, `descent/proof.f.mjs:10` and `data/proof.f.mjs:7` import
the front end and `testlib.f.mjs`, so stage 8's deletion could not pass the
suite. It also makes `descentEquivalence`
front-end neutral for the first time. `matcher/proof.f.mjs` is not in this
rewrite: its one front-end import is `eofSymbol`, which stage 1 repoints, and
it builds no grammar.

**A proof travels with what it proves**, so the rewrite is a split, not a
wholesale conversion. Only the cases covering neutral behaviour become
`RuleSet` literals. The cases covering something that *moves* in stage 5 go
with it: `data/proof.f.mjs`'s `toData` / `toDataWithRules` sections are the
co-located coverage for the conversion, and `ll1/proof.f.mjs` and
`descent/proof.f.mjs` cover the `parser(fr)` / `descentParser(fr)` wrappers.
Converting those to rule sets would delete the only coverage of exports that
still exist; leaving them behind would strand it. They move to
`fjs/grammar/bnf/proof.f.mjs` in the same PR as the code they cover.

**What one hop promises.** Each *API* moves once, never landing at an
intermediate public path. Not that each consumer is edited once: a module
importing APIs bound for several destinations is edited once per destination.
`fjs/djs/parser` is the extreme case — it takes `eof`, `oneEncode`, `option`,
`rangeDecode`, `repeat0Plus` and `unicodeRange` from *one* import line that
this plan splits three ways — so it is touched at stages 1, 2, 5, 6 and again
at its port. There are no compatibility re-exports anywhere; adding them would
create the intermediate paths the rule forbids. Outside `fjs/bnf` itself the
module has exactly five consumers, all under `fjs/djs`.

#### Where the issues go

`fjs/bnf/todo/` holds twenty-two issues and almost none is about the classical
`Rule` union, so it cannot travel with the front end and be deleted with it.
An issue goes where the code it describes goes:

- **`data/todo/`** — `rule-visitor`, `665-bnf-data-fold-children`,
  `042-mixing-serializable-bnfs`.
- **`terminal/todo/`** — `bigint-symbols`, `terminal-range-representation`,
  `eof-as-ordinary-symbol`. (`terminal-range-shared-type` closes in stage 1.)
- **`unicode/todo/`** — `unicode-rules`.
- **`token_symbol/todo/`** — `utf8-token-symbols`,
  `tokens-with-extra-information`.
- **`fjs/grammar/todo/`** — the parser/recognizer family (`recognizer-backend`,
  `032-stupid-parser`, `043-stateful-parser`, `046-lr1-parser`,
  `layered-parser`, `parser-structure`, `generic-parser-metadata`), which
  describe backends that do not exist yet; the cross-cutting proof issues
  (`proof-recognizer-and-fixtures`, `serialized-proof-expectations`); and
  `207-bnf-semantic-actions`, about the protocol stage 3 genericizes.
- **`bnf/todo/`, closing in stage 8** — only `ebnf-front-end`.
  `bnf-grammar-single-owner` goes to `fjs/grammar/todo/` with the rest: its
  open work is about the surviving `grammar/lib` grammars and the `fsc`
  tokenizer, so deleting the classical front end settles none of it.

A module the migration creates goes to its final path immediately, never to
`fjs/bnf/` first.

### Tasks

- [ ] Stage 1: extract the codec to `fjs/grammar/terminal/` with
      `TerminalRange`, `RangeVariant` and the backends' symbol type (so
      `remove`/`not` signatures and `matcher`/`ll1`/`descent` stop naming the
      front end and `CodePoint`); drop the `data/types.ts` redeclaration and
      the `descent/types.ts` front-end import. Repoint **every** consumer in
      the same PR, since there are no re-exports: `data`, `matcher`, `ll1`,
      `descent`, `token_symbol`, the front-end module itself (it calls the
      codec internally), and both `fjs/djs` roots: `parser/module.f.mjs`
      takes `eof`, `oneEncode` and `rangeDecode`, `tokenizer/module.f.mjs`
      takes `eof`. Each splits its import here and keeps its Unicode helpers
      pointed at the front end until stage 2.
- [ ] Stage 1: give `terminal/` a co-located `proof.f.mjs`, carrying the codec
      cases out of `fjs/bnf/proof.f.mjs` — `rangeEncode`, `rangeDecode`,
      `oneEncode`, `eofSymbol` / `eof`, `fullRange` and its boundary case
      (`fjs/bnf/proof.f.mjs:66`), and their invalid-input cases. A new
      `.f.mjs` module ships 100% co-located coverage
      ([fjs/AGENTS.md](../AGENTS.md)), so rerunning the BNF proofs is not
      enough.
- [ ] Rewrite `terminal-range-shared-type` to name `terminal/` as owner, and
      delete it in the stage-1 PR that implements it.
- [ ] Stage 2: land `unicode-rules` at `fjs/grammar/unicode/` and point
      `token_symbol` there — after `ebnf-front-end`'s Problem 9 settles the
      adapter's shape.
- [ ] Stage 3: genericize the transformer protocol and `RuleNameMap<R>` /
      `GrammarData<R>`. Types only.
- [ ] Stage 4: backends over `RuleSet` only; `transformers` takes the grammar
      data. The wrappers stay put — they move in stage 5.
- [ ] Before stage 5: rewrite the backend proofs against `RuleSet` literals;
      revise `proof-recognizer-and-fixtures` so its fixtures and adapters are
      neutral; give every `fjs/bnf/todo/` issue the destination above.
- [ ] Stage 5: split `fjs/bnf/README.md` to its owners, creating
      `fjs/grammar/README.md`, and repoint every inbound link.
- [ ] Stage 5: move the front end to `fjs/grammar/bnf/` with the conversion
      and the wrappers, and the proof cases that cover them; repoint the
      `lib/` grammars (which do not move until stage 7, so their front-end
      imports repoint without moving) and every README and `todo/` link.
- [ ] Stage 5, `fjs/djs`: `parser/module.f.mjs` and `tokenizer/module.f.mjs`
      import the front-end root and repoint here. The two `private.ts` files
      import `matcher` and wait for stage 6. `tokenizer/proof.f.mjs` takes
      both `isRepeat` and `toData` from `data` on one line: `toData` moves
      with the conversion now, so split the import here and leave `isRepeat`
      for stage 6.
- [ ] Stage 6: move `data/`, `matcher/`, `ll1/`, `descent/`, `token_symbol/`
      and `map/types.ts`, one PR each.
- [ ] Stage 7: move `lib/`; add `fjs/grammar/ebnf/`.
- [ ] Rewrite the "Later candidates" bullet of
      [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
      once the bucket exists, recording that `fsc` and `js` stay out.
- [ ] Stage 8: delete `fjs/grammar/bnf/`.
- [ ] `tsc`, `fjs t` at every stage. Every stage moves a public path, so each
      PR declares `**BREAKING CHANGES:**` in its `Changelog:` section
      ([changelog/RELEASE.md](../../changelog/RELEASE.md)).

### Related

- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — the regrouping plan this belongs to; it set the one-move-per-PR rule.
- [ebnf-front-end](../bnf/todo/ebnf-front-end.md) — the second front end. Its
  *implementation* is blocked on stages 1-5; its Problem 9 is design work that
  gates stage 2, so the two are ordered rather than circular.
- [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md) —
  repointed at `terminal/` and implemented by stage 1.
- [unicode-rules](../bnf/todo/unicode-rules.md) — stage 2; its adapters are
  bucket siblings that outlive the classical front end.
- [rule-visitor](../bnf/todo/rule-visitor.md) — lands in the moved `data/`.
- [recognizer-backend](../bnf/todo/recognizer-backend.md) — its new backends
  are bucket modules, created at their final paths.
- [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)
  — the media codecs take no runtime dependency on these modules.

## grammar-bucket. Group the grammar modules under `fjs/grammar/`

**Priority:** P3
**Status:** open

### Problem

`fjs/bnf/` holds two different things under one name. One is a **functional
front end**: `module.f.mjs` and `types.ts` (the `Rule` union and its
constructors), `map/rtti/` (rule-to-transformer maps keyed by functional rule
identity), and the example grammars under `lib/`. The other is **front-end
neutral machinery** that only ever sees the serializable `RuleSet` of
[`data/`](../bnf/data/README.md): the IR itself, `emptyTagMap`, the shared
[`matcher/`](../bnf/matcher/README.md) layer, the [`ll1/`](../bnf/ll1/README.md)
and [`descent/`](../bnf/descent/README.md) backends, and `token_symbol/`.

[group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
already lists "a tooling bucket for `bnf`, `fsc`, and possibly `js`" as a later
candidate. "Tooling" has no crisp membership rule; **grammar** does, and it is
what the module is actually about.

The split matters now because a second front end is coming
([ebnf-front-end](../bnf/todo/ebnf-front-end.md)): a `Rule` union with a
repetition primitive, so that `toData` transcribes a repeat instead of
recognizing one by shape. It has to share the neutral machinery, and today it
cannot, because every neutral module imports the front end:

- `data/module.f.mjs` imports `oneEncode` from `../module.f.mjs`, and it hosts
  `toData` / `toDataWithRules` — the conversion *from* the functional layer —
  next to the IR.
- `matcher/module.f.mjs` imports `eofSymbol` from `../module.f.mjs`.
- `ll1/module.f.mjs` and `descent/module.f.mjs` import `rangeDecode` from
  `../module.f.mjs` and `toData` from `../data/module.f.mjs`; each exports a
  convenience entry (`parser`, `descentParser`) that takes a *functional* rule,
  and the LL(1) `transformers` builder calls `toDataWithRules` itself.
- `token_symbol/module.f.mjs` imports `fullRange`, `rangeDecode`, and
  `unicodeRange` from `../module.f.mjs`.
- `matcher/types.ts` imports the functional `Rule` and *spreads it through the
  transformer protocol*: the `repeat` arm of `Transformer`, `Entry.rule`,
  `TransformerMap.entries`, and `TransformerTools.entry` / `repeatOf` are all
  typed by it. `data/types.ts` does the same in `RuleNameMap` and the
  `GrammarData` triple built on it.

That last one is the deepest: it is a *type-level* dependency, so moving the
conversion alone would leave a second front end unable to type-check against
the supposedly neutral matcher and LL(1) transformer APIs even though no
runtime code is shared.

There is a second, independent coupling in the same layer, to the *alphabet*
rather than to the front end. `matcher/types.ts:10`, `ll1/types.ts:7` and
`descent/types.ts:12` import `CodePoint` from `text/utf16`, and spell their
public surfaces `Meta<M, CodePoint>` — the LL(1) `Remainder`, `MatchResult`
and `Match`, and the matcher's terminal transformer. So a backend used over
[token symbols](../bnf/token_symbol/) already contradicts its own types today.
Moving these modules does not fix it, and the layout's claim that a backend
depends only on `matcher`, `data` and `terminal` is false until it is fixed:
the symbol type has to come from `terminal/`, or the backend APIs have to be
parameterized over it.

Everything those imports need is the terminal codec — how a range packs two
stored endpoint codes and where EOF lives
([Terminals and EOF](../bnf/README.md#terminals-and-eof)) — which is not
front-end business at all.

### Proposal

#### Layout

```text
fjs/grammar/
  terminal/      the TerminalRange type and its codec, alphabet-neutral
                 only: rangeEncode, rangeDecode, oneEncode, eofSymbol, eof,
                 fullRange, maxSymbol, remove, not
  data/          RuleSet IR, emptyTagMap, detectRepeat        → terminal
  matcher/       shared cursor, EOF, AST, transformer tools   → data, terminal
  ll1/           backend over RuleSet only                    → matcher, terminal
  descent/       backend over RuleSet only                    → matcher, terminal
  token_symbol/  multi-character token alphabet               → terminal
  map/           AST-level mapping types (today map/types.ts) → matcher
  unicode/       text alphabet: str, set, range, notSet,
                 toSequence, unicodeRange, unicodeMax         → terminal
  byte/          binary alphabet, when it exists              → terminal
  bnf/           classical front end: Rule, constructors, its
                 toData, its rtti map                         → data, unicode
  ebnf/          front end with a repetition primitive, its
                 toData, its rtti map                         → data, unicode
  lib/           example grammars (json, datajs)              → a front end
```

`terminal/` owns the `TerminalRange` **type**, not just the codec. Today
`fjs/bnf/types.ts` declares it and `data/types.ts` redeclares it, which
[terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md) exists
to fix — but that issue names the classical front end as the single owner,
which would make `data → bnf` permanent and survive `bnf`'s deletion.
`descent/types.ts` already imports the type from the front end today, so the
arrows above cannot hold until the owner changes. Its reasoning picks the
right home once the codec has one: the owner is *the module that owns the
range primitives' types*, which is `terminal/`. That issue is rewritten to say
so, and it is then a step of this one rather than a conflict with it.

The alphabet adapters are grammar-bucket siblings, **not** front-end
components. [unicode-rules](../bnf/todo/unicode-rules.md) creates
`unicode/` (and reserves `byte/` for
[recognizer-backend](../bnf/todo/recognizer-backend.md)), and both front ends
take their text terminals from `unicode/`: whether `ebnf` keeps a `string`
in its rule union is an open question there, but the *lowering* of text to
symbols is the adapter's either way
([ebnf-front-end](../bnf/todo/ebnf-front-end.md)). So `unicode/` outlives the
classical front end, and that issue is not `bnf`-only.

**Membership rule:** a module goes under `fjs/grammar/` iff it defines,
transforms, or executes grammars over a symbol alphabet. `fsc` is a compiler
and `js/tokenizer` is a hand-written scanner: both are consumers and stay out.
`djs` is a consumer too and keeps its planned move to `fjs/media/`
([parser-serializer-restructure](../../todo/parser-serializer-restructure.md)
moves its grammar-based front end to `fjs/fsc`, BNF dependency intact).

**Dependency rule:** nothing below a front end imports a front end. The two
front ends are siblings that produce the same `RuleSet`, and the
`descentEquivalence` proof group in `ll1/proof.f.mjs` — which pins the AST both
backends build from one `RuleSet` — is the guard that they agree.

#### Sequencing: one public path change per API

Two rules pull against each other. The dependency inversion wants to happen
before anything moves; the one-move-per-PR rule from
[group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
wants every public path to change **once**, because directory paths are the
public API here (no `exports` map) so each change is breaking.

Doing the inversion "in place inside `fjs/bnf/`" loses that second rule: an
extracted `fjs/bnf/terminal/` would move again to `fjs/grammar/terminal/`, and
`toData` would travel from `fjs/bnf/data/` to `fjs/bnf/` and then to
`fjs/grammar/bnf/` — two breaking changes each. The resolution is that the
inversions which are **type- or signature-only** move no path at all, so they
go first and for free; the two that do relocate an API go straight to the
final path.

That gives one order in which no API moves twice and no stage leaves a
backwards import standing:

1. **`fjs/grammar/terminal/`** — extract the alphabet-neutral codec out of
   `fjs/bnf/module.f.mjs` **directly to its final path**, and make it the
   owner of the `TerminalRange` type, removing the redeclaration in
   `data/types.ts` and the front-end import in `descent/types.ts`. It owns
   `RangeVariant` too (`fjs/bnf/types.ts:64`): `remove` and `not` take and
   return it, so leaving the type in the front end's `types.ts` would make the
   neutral module import a front end for the signatures of the very functions
   it just took. The symbol type the backends spell as `CodePoint` belongs
   here as well, or the backends are parameterized over it — see the problem
   above. Point
   `data`, `matcher`, `ll1`, `descent`, and `token_symbol` at it. This
   establishes the bucket, and it also closes
   [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md)
   once that issue is repointed at this owner. The text-interpreting helpers
   are untouched — they are `unicode/`'s, and
   [unicode-rules](../bnf/todo/unicode-rules.md) moves them.
2. **`fjs/grammar/unicode/`** — the text alphabet split that
   [unicode-rules](../bnf/todo/unicode-rules.md) designs, landed **directly at
   its final path** (with `byte/` beside it if
   [recognizer-backend](../bnf/todo/recognizer-backend.md) needs it by then).
   It has to be here, not late: `token_symbol/module.f.mjs` uses
   `unicodeRange` to place token symbols above Unicode, so until `unicode/`
   exists `token_symbol` cannot be pointed away from the front end, and stage
   5 would leave it importing `fjs/grammar/bnf/` — the one backwards import
   this order exists to avoid. The front end keeps its combinators and simply
   depends on `unicode/` from here on.
3. **Genericize the transformer protocol** over the rule identity.
   `matcher/types.ts` types `Entry.rule`, `TransformerMap.entries`, the
   `repeat` arm of `Transformer`, and `TransformerTools.entry` / `repeatOf`
   with the classical `Rule`. The matcher never inspects a rule it is keyed
   by — the identity is an opaque map key — so these become generic over `R`,
   and each front end instantiates them at its own `Rule`. Types only: no
   path moves, no runtime change.

   The **builder's input** has to be genericized in the same stage, not just
   the transformer protocol. `data/types.ts:58` fixes `RuleNameMap` to the
   classical `FRule`, and `GrammarData` embeds it, so a stage-4 builder taking
   "the grammar data" would take a classical type — leaving the supposedly
   neutral LL(1) builder importing `grammar/bnf`, or forcing a second public
   signature change in stage 5. Instead `data/` keeps both, parameterized:
   `RuleNames<R> = ReadonlyMap<R, string>` and
   `GrammarData<R> = [RuleSet, string, RuleNames<R>]`. Generic over `R` they
   name no front end, so `data/` stays neutral and each front end supplies its
   own instantiation. Stage 5 then moves only the classical alias
   (`GrammarData<FRule>`), not the type.
4. **Backends over `RuleSet` only.** `parserRuleSet` and
   `descentParserRuleSet` stay where they are. `parser(fr)` and
   `descentParser(fr)` take a *functional* rule, so they are front-end
   convenience wrappers living in the wrong module; they are **re-homed, not
   dropped**, and they move exactly once — in stage 5, in the same PR that
   moves the front end, from `ll1/` and `descent/` straight to
   `fjs/grammar/bnf/`. Doing it here instead would move them twice, and
   leaving the choice open (an earlier draft said "drop or re-home") leaves a
   public API's fate undecided at implementation time, which is not something
   a stage list may do. The LL(1) `transformers` builder takes the
   grammar data as an argument instead of converting. Signatures only, and
   sound only after 3 has removed the type-level dependency.
5. **`fjs/grammar/bnf/`** — move the classical front end to its final path
   **and** carry `toData`, `toDataWithRules`, `data/private.ts`,
   `RuleNameMap`, `GrammarData`, and `repeatItem` into it from `data/` in the
   same change, plus the two convenience wrappers from stage 4. `toData`'s
   return type goes with it as the classical instantiation of the generic
   `GrammarData<R>` that stage 3 leaves behind in `data/`. The front end
   is `module.f.mjs`, `types.ts`, the root `private.ts` (`testlib.f.mjs`
   imports it), `proof.f.mjs` (it imports `./module.f.mjs` and
   `./testlib.f.mjs`, so it is front-end-specific and stays co-located with
   what it proves), `testlib.f.mjs`, and `map/rtti/`.

   **`fjs/bnf/README.md` is split, not moved.** It is the one file in the
   directory that is mostly *not* about the front end, and stage 8 would
   delete the only copy of several normative decisions. Its sections go to
   their owners: "The AST is one contract" and "AST" state what every backend
   must produce, so they belong to `fjs/grammar/README.md` — the bucket's own
   overview, which this stage creates; "Terminals and EOF" is `terminal/`'s;
   "Dispatch" is `ll1/`'s; "Serializable Data Representation" is already
   covered by `data/README.md` and collapses into a link. Only "Functional
   Representation" and "Common Patterns" describe the classical front end and
   travel with it, the latter to be deleted with it, since the repeat pattern
   it documents is exactly what `ebnf` replaces.

   Three inbound links have to be repointed in the same change, and they are
   in these very issues: `grammar-bucket.md` and `ebnf-front-end.md` both
   link `../bnf/README.md#terminals-and-eof`, and `ebnf-front-end.md` links
   `#ast`. A README that survives only as a dangling anchor is the failure
   this bullet exists to prevent. Leaving any of them
   behind either strands a proof at a path whose module has gone or leaves a
   dependency pointing back into the emptied bucket.

   **Before this stage, decouple the backend proofs.** `ll1/proof.f.mjs:14`
   and `descent/proof.f.mjs:10` import front-end constructors, and both also
   import `testlib.f.mjs`; `data/proof.f.mjs:7` and `matcher/proof.f.mjs:8`
   import the front end too. If they move with the neutral backends in stage 6
   while their fixtures live in `grammar/bnf/`, stage 8's deletion cannot pass
   the suite. Rewrite them against `RuleSet` literals — which is also what
   makes `descentEquivalence` a front-end-neutral guard for the first time,
   rather than a proof that the two backends agree on one front end's
   spelling.
   One change for both, because splitting them is exactly what would move
   `toData` twice. After it, `data/types.ts` has no front-end import and the
   remaining `fjs/bnf/*` modules are neutral.
6. **The neutral modules** — `data/`, `matcher/`, `ll1/`, `descent/`,
   `token_symbol/`, and `map/types.ts` (as `fjs/grammar/map/`) — move to
   `fjs/grammar/`, one per PR. Order among them is free: after stage 5 none
   imports a front end, and stages 1-2 already gave them `terminal/` and
   `unicode/`.
7. **`fjs/grammar/lib/`**, then `fjs/grammar/ebnf/` as new code
   ([ebnf-front-end](../bnf/todo/ebnf-front-end.md)).
8. The consumers migrate to `ebnf` one grammar per PR; then
   `fjs/grammar/bnf/` is deleted. `detectRepeat` stays in `data/` as the
   opt-in normalization for deserialized or hand-written rule sets, and
   `unicode/` stays as both front ends' text alphabet.

Stages 3 and 4 are the only ones that could be reordered freely; everything
else is fixed by what it depends on.

**What one hop does and does not promise.** The rule is that each *API* moves
once — no export lands at an intermediate public path on its way to its final
one. It is not a promise that each consumer is edited once: a module importing
APIs that end up in several different destinations is updated once per
destination, and that is the minimum, not churn. `fjs/djs/parser` is the
extreme case, and worth reading before planning a stage, because today it
takes `eof`, `oneEncode`, `option`, `rangeDecode`, `repeat0Plus`, and
`unicodeRange` from the *single* module `fjs/bnf/module.f.mjs` — three
destinations in one import line — plus `toData` from `bnf/data`,
`descentParserRuleSet` from `bnf/descent`, `encoding` from `bnf/token_symbol`,
and types from `bnf/types.ts`, `bnf/matcher`, and `bnf/descent`. So it is
touched at stages 1, 2, 5, 6, and again at its own port in stage 8. Each of
those edits is a different API arriving at its final home; none of them is the
same API moving twice. Every such importer is updated in the same PR as the
move, as [AGENTS.md §5](../../AGENTS.md) requires — there are no compatibility
re-exports anywhere in this plan, and adding them would create exactly the
intermediate paths the one-hop rule forbids.

Each `todo/` directory moves with its module, as the `basen` move did — but
`fjs/bnf/todo/` is the root of a directory that is being *split*, so its
twenty-odd issues cannot simply travel with the front end and then be deleted
with it in stage 8. Almost none of them is about the classical `Rule` union.
Every one needs a destination named before stage 5 moves the directory:

- **`data/todo/`** — [rule-visitor](../bnf/todo/rule-visitor.md),
  [665-bnf-data-fold-children](../bnf/todo/665-bnf-data-fold-children.md),
  [042-mixing-serializable-bnfs](../bnf/todo/042-mixing-serializable-bnfs.md).
- **`terminal/todo/`** — [bigint-symbols](../bnf/todo/bigint-symbols.md),
  [terminal-range-representation](../bnf/todo/terminal-range-representation.md),
  [eof-as-ordinary-symbol](../bnf/todo/eof-as-ordinary-symbol.md).
  [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md) is
  closed by stage 1 itself.
- **`unicode/todo/`** — [unicode-rules](../bnf/todo/unicode-rules.md), which
  outlives the classical front end.
- **`token_symbol/todo/`** —
  [utf8-token-symbols](../bnf/todo/utf8-token-symbols.md),
  [tokens-with-extra-information](../bnf/todo/tokens-with-extra-information.md).
- **A backend home** — the parser-and-recognizer family:
  [recognizer-backend](../bnf/todo/recognizer-backend.md),
  [032-stupid-parser](../bnf/todo/032-stupid-parser.md),
  [043-stateful-parser](../bnf/todo/043-stateful-parser.md),
  [046-lr1-parser](../bnf/todo/046-lr1-parser.md),
  [layered-parser](../bnf/todo/layered-parser.md),
  [parser-structure](../bnf/todo/parser-structure.md),
  [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md). These
  describe *new backends* rather than an existing module, so they belong to
  `fjs/grammar/todo/` — the bucket's own issue directory — unless one names a
  backend that already exists.
- **`fjs/grammar/todo/`** likewise for the cross-cutting proof issues,
  [proof-recognizer-and-fixtures](../bnf/todo/proof-recognizer-and-fixtures.md)
  and
  [serialized-proof-expectations](../bnf/todo/serialized-proof-expectations.md),
  and for
  [207-bnf-semantic-actions](../bnf/todo/207-bnf-semantic-actions.md), which is
  about the transformer protocol that stage 3 genericizes.
- **`bnf/todo/`, and closed with it in stage 8** — only
  [bnf-grammar-single-owner](../bnf/todo/bnf-grammar-single-owner.md) and
  [ebnf-front-end](../bnf/todo/ebnf-front-end.md), the latter because it is
  finished by then.

The rule behind the list: an issue goes where the code it describes goes, and
"the classical front end" is a much smaller set than the directory it
currently sits in. Deleting `bnf/todo/` wholesale in stage 8 would discard
tracked backend and alphabet work that has nothing to do with the front end.

A new module the migration creates carries its issues to its final path
directly, never to `fjs/bnf/` first: [recognizer-backend](../bnf/todo/recognizer-backend.md)
names `fjs/bnf/recognizer` and `fjs/bnf/dfa` today, and both execute grammars,
so they are `fjs/grammar/recognizer` and `fjs/grammar/dfa` under the
membership rule. That issue is blocked only until the stage-2 alphabet split,
so it can land *before* stage 6 — which is exactly why its paths must be
corrected now rather than caught by a later move list.

### Tasks

- [ ] Stage 1: extract the alphabet-neutral codec to `fjs/grammar/terminal/`
      directly, with `TerminalRange` as its type; drop the redeclaration in
      `data/types.ts` and the front-end import in `descent/types.ts`; point
      `data`, `matcher`, `ll1`, `descent`, and `token_symbol` at it.
- [ ] Rewrite [unicode-rules](../bnf/todo/unicode-rules.md)'s proposal, tasks,
      and import examples to name `fjs/grammar/unicode/` and
      `fjs/grammar/byte/` rather than `fjs/bnf/*`, and record that it depends
      on stage 1 for `terminal/`.
- [ ] Rewrite [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md)
      to name `terminal/` as the owner instead of the classical front end, and
      delete it in the stage-1 PR that implements it.
- [ ] Stage 2: land [unicode-rules](../bnf/todo/unicode-rules.md)'s split at
      `fjs/grammar/unicode/` directly, and point `token_symbol` there for
      `unicodeRange` so it no longer reads from the front end.
- [ ] Stage 3: genericize the transformer protocol over the rule identity in
      `matcher/types.ts`, **and** `RuleNames<R>` / `GrammarData<R>` in
      `data/types.ts`, so the stage-4 builder has a neutral input. Types only.
- [ ] Stage 4: backends over `RuleSet` only; `transformers` takes the grammar
      data. The convenience wrappers stay put here — they move once, in
      stage 5.
- [ ] Before stage 5: rewrite the backend proofs against `RuleSet` literals so
      they stop importing front-end constructors and `testlib.f.mjs`.
- [ ] Before implementing it, revise
      [proof-recognizer-and-fixtures](../bnf/todo/proof-recognizer-and-fixtures.md)
      to build neutral fixtures. It is blocked only until stage 2, so it
      becomes actionable *before* that rewrite — and as written it goes the
      opposite way: its recognizer adapters take an `FRule`, derive the root
      from `toData(rule)[1]`, and live in `fjs/bnf/testlib.f.mjs`, which is
      exactly the front-end coupling in the backend proofs that the rewrite
      exists to remove. Implementing it first would build that coupling
      deliberately, then require undoing it, or would block the stage-8
      deletion. Its adapters should take a `RuleSet`, which both backends
      already accept through `parserRuleSet` / `descentParserRuleSet`.
- [ ] Before stage 5: give every issue in `fjs/bnf/todo/` the destination named
      above, and correct
      [recognizer-backend](../bnf/todo/recognizer-backend.md)'s `fjs/bnf/recognizer`
      and `fjs/bnf/dfa` to `fjs/grammar/`.
- [ ] Stage 5: split `fjs/bnf/README.md` to the owners named above, creating
      `fjs/grammar/README.md`, and repoint every inbound link — including the
      ones in these two issues.
- [ ] Stage 5: move the front end to `fjs/grammar/bnf/` and carry `toData` /
      `toDataWithRules` / `data/private.ts` / `RuleNameMap` / `GrammarData` /
      `repeatItem` into it in the same PR; update the `djs` and
      `fjs/rtti/common` importers and every README / `todo/` link.
- [ ] Stage 6: move `data/`, `matcher/`, `ll1/`, `descent/`, `token_symbol/`,
      and `map/types.ts` to `fjs/grammar/`, one PR each, `rule-visitor.md`
      travelling with `data/`.
- [ ] Stage 7: move `lib/` → `fjs/grammar/lib/`; add `fjs/grammar/ebnf/`.
- [ ] `tsc`, `fjs t` at every stage. Every stage moves a public path, so each
      PR declares `**BREAKING CHANGES:**` in its `Changelog:` section — that
      declaration is the version-bump signal and nothing derives it from the
      diff ([changelog/RELEASE.md](../../changelog/RELEASE.md)). The removed
      backend convenience entries are a break too.
- [ ] Rewrite the "Later candidates" bullet of
      [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
      once the bucket exists, and record that `fsc` and `js` stay out.
- [ ] After [ebnf-front-end](../bnf/todo/ebnf-front-end.md) lands and the
      consumers are ported: delete `fjs/grammar/bnf/` and its `todo/`.

### Related

- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — the regrouping plan this bucket belongs to; it set the one-move-per-PR
  rule and left the tooling bucket undecided.
- [ebnf-front-end](../bnf/todo/ebnf-front-end.md) — the second front end;
  blocked on stages 1-**5** here — the terminal and text alphabets, the
  inversion, and the front-end extraction that finally makes `data/` neutral —
  not on stage 6's moves of the already-neutral modules.
- [rule-visitor](../bnf/todo/rule-visitor.md) — the data `Rule` visitor; the
  moved `data/` module is where it lands.
- [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md) —
  the same one-owner move for the `TerminalRange` type, but it names the
  classical front end as the owner; stage 1 repoints it at `terminal/` and
  implements it.
- [recognizer-backend](../bnf/todo/recognizer-backend.md) — the `byte/`
  adapter it is waiting on is a bucket sibling here, not a front-end part.
- [unicode-rules](../bnf/todo/unicode-rules.md) — already assigns
  `unicodeRange`, `unicodeMax`, `toSequence`, `str`, `set`, `range`, and
  `notSet` to the alphabet adapter, by the rule that an API interpreting text
  as code points is not core. `terminal/` is the other side of that same
  boundary and takes only what is left, so neither set of helpers moves twice.
  Its `unicode/` module is a bucket sibling that both front ends depend on, so
  it outlives the classical one rather than closing with it.
- [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)
  — the media codecs take no runtime dependency on the grammar modules, and
  the `djs` front end moves to `fjs/fsc` as a consumer.

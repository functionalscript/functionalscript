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
take their text terminals from `unicode/` — `ebnf` most of all, since it has
no string literal of its own
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
   `data/types.ts` and the front-end import in `descent/types.ts`. Point
   `data`, `matcher`, `ll1`, `descent`, and `token_symbol` at it. This
   establishes the bucket, and it also closes
   [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md)
   once that issue is repointed at this owner. The text-interpreting helpers
   are untouched — they are `unicode/`'s, and
   [unicode-rules](../bnf/todo/unicode-rules.md) moves them.
2. **Genericize the transformer protocol** over the rule identity.
   `matcher/types.ts` types `Entry.rule`, `TransformerMap.entries`, the
   `repeat` arm of `Transformer`, and `TransformerTools.entry` / `repeatOf`
   with the classical `Rule`. The matcher never inspects a rule it is keyed
   by — the identity is an opaque map key — so these become generic over `R`,
   and each front end instantiates them at its own `Rule`. Types only: no
   path moves, no runtime change.
3. **Backends over `RuleSet` only.** Drop `parser(fr)` and
   `descentParser(fr)` or re-home them in the front end; `parserRuleSet` and
   `descentParserRuleSet` stay. The LL(1) `transformers` builder takes the
   grammar data as an argument instead of converting. Signatures only, and
   sound only after 2 has removed the type-level dependency.
4. **`fjs/grammar/bnf/`** — move the classical front end (`module.f.mjs`,
   `types.ts`, `map/rtti/`, `testlib.f.mjs`) to its final path **and** carry
   `toData`, `toDataWithRules`, `data/private.ts`, `RuleNameMap`,
   `GrammarData`, and `repeatItem` into it from `data/` in the same change.
   One change for both, because splitting them is exactly what would move
   `toData` twice. After it, `data/types.ts` has no front-end import and the
   remaining `fjs/bnf/*` modules are neutral.
5. **The neutral modules** — `data/`, `matcher/`, `ll1/`, `descent/`,
   `token_symbol/`, and `map/types.ts` (as `fjs/grammar/map/`) — move to
   `fjs/grammar/`, one per PR. Order among them is free: after stage 4 none
   imports a front end, and stage 1 already gave them `terminal/`.
6. **`fjs/grammar/lib/`**, then `fjs/grammar/unicode/` when
   [unicode-rules](../bnf/todo/unicode-rules.md) lands, then
   `fjs/grammar/ebnf/` as new code
   ([ebnf-front-end](../bnf/todo/ebnf-front-end.md)).
7. The consumers migrate to `ebnf` one grammar per PR; then
   `fjs/grammar/bnf/` is deleted. `detectRepeat` stays in `data/` as the
   opt-in normalization for deserialized or hand-written rule sets, and
   `unicode/` stays as both front ends' text alphabet.

Stages 2 and 3 are the only ones that could be reordered freely; everything
else is fixed by what it depends on. The consumers outside the bucket — the
`djs` tokenizer and parser with their `private.ts` files, and
`fjs/rtti/common` — see exactly two path changes across the whole migration:
stage 4, and their own port in stage 7.

Each `todo/` directory moves with its module, as the `basen` move did.
[rule-visitor](../bnf/todo/rule-visitor.md) is about the data `Rule` and moves
to `data/todo/`; [unicode-rules](../bnf/todo/unicode-rules.md) belongs to
`unicode/` and outlives the classical front end; only issues that are
genuinely about the classical `Rule` union close with `bnf/`.

### Tasks

- [ ] Stage 1: extract the alphabet-neutral codec to `fjs/grammar/terminal/`
      directly, with `TerminalRange` as its type; drop the redeclaration in
      `data/types.ts` and the front-end import in `descent/types.ts`; point
      `data`, `matcher`, `ll1`, `descent`, and `token_symbol` at it.
- [ ] Rewrite [terminal-range-shared-type](../bnf/todo/terminal-range-shared-type.md)
      to name `terminal/` as the owner instead of the classical front end, and
      delete it in the stage-1 PR that implements it.
- [ ] Stage 2: genericize the transformer protocol over the rule identity in
      `matcher/types.ts`. Types only.
- [ ] Stage 3: backends over `RuleSet` only; `transformers` takes the grammar
      data. Re-home the functional convenience entries.
- [ ] Stage 4: move the front end to `fjs/grammar/bnf/` and carry `toData` /
      `toDataWithRules` / `data/private.ts` / `RuleNameMap` / `GrammarData` /
      `repeatItem` into it in the same PR; update the `djs` and
      `fjs/rtti/common` importers and every README / `todo/` link.
- [ ] Stage 5: move `data/`, `matcher/`, `ll1/`, `descent/`, `token_symbol/`,
      and `map/types.ts` to `fjs/grammar/`, one PR each, `rule-visitor.md`
      travelling with `data/`.
- [ ] Stage 6: move `lib/` → `fjs/grammar/lib/`; land `fjs/grammar/unicode/`
      with [unicode-rules](../bnf/todo/unicode-rules.md); add
      `fjs/grammar/ebnf/`.
- [ ] `tsc`, `fjs t` at every stage; changelog entries marked
      **BREAKING CHANGES** for each path change and for the removed backend
      entries.
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
  blocked on stages 1-4 here — the inversion — not on the later moves, and it
  depends on `unicode/` from stage 6 for its text terminals.
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

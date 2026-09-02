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
  terminal/      packed-range and EOF codec, alphabet-neutral only:
                 rangeEncode, rangeDecode, oneEncode, eofSymbol, eof,
                 fullRange, maxSymbol, remove, not
  data/          RuleSet IR, emptyTagMap, detectRepeat        → terminal
  matcher/       shared cursor, EOF, AST, transformer tools   → data, terminal
  ll1/           backend over RuleSet only                    → matcher
  descent/       backend over RuleSet only                    → matcher
  token_symbol/  multi-character token alphabet               → terminal
  map/           AST-level mapping types (today map/types.ts) → matcher
  bnf/           classical front end: Rule, constructors, its
                 toData, its rtti map                         → data
  ebnf/          front end with a repetition primitive, its
                 toData, its rtti map                         → data
  lib/           example grammars (json, datajs)              → a front end
```

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

#### Step 0: invert the arrows in place

No paths move until the neutral modules stop importing the front end. This is
one refactor inside `fjs/bnf/`, importers unaffected:

1. Split the terminal codec out of `fjs/bnf/module.f.mjs` into a module that
   becomes `terminal/`. Whether `unicodeRange` belongs there or in the
   alphabet-specific module that [unicode-rules](../bnf/todo/unicode-rules.md)
   introduces is that issue's call; this one only moves it out of the front
   end.
2. Move `toData` and `toDataWithRules` (with `private.ts`) from `data/` into
   the front end. `data/` keeps the IR, `isRepeat`, `emptyTagMap`, and
   `detectRepeat`. `repeatItem` goes with the front end's rtti map, the only
   caller.
3. Make the rule **identity** a type parameter of the transformer protocol.
   The matcher never inspects a rule it is keyed by — it uses the identity as
   an opaque map key — so `Transformer`, `Entry`, `TransformerMap`, and
   `TransformerTools` become generic over an identity type `R`, and each front
   end instantiates them at its own `Rule`. `RuleNameMap` and `GrammarData`
   name a functional rule outright, so they move to the front end in step 0.2
   with the conversion that returns them; `data/types.ts` then has no import
   from a front end at all.
4. Backends take a `RuleSet` only. Drop `parser(fr)` and `descentParser(fr)`
   or re-home them in the front end; `parserRuleSet` and
   `descentParserRuleSet` stay. The LL(1) `transformers` builder takes the
   grammar data as an argument instead of converting — which removes its
   *runtime* dependency on the front end, and is only sound once item 3 has
   removed the type-level one.

After step 0 every move is mechanical.

#### Moves

The rule from
[group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
holds: one move per PR, and every move is breaking because directory paths are
the public API (no `exports` map). So each module goes to its **final home in
one hop** — renaming `fjs/bnf/` to `fjs/grammar/bnf/` first and splitting
afterwards would move the neutral modules twice.

1. `terminal/`, then `data/`, then `matcher/`, then `ll1/`, `descent/`,
   `token_symbol/`, and `map/`. Leaf first, so each PR imports only what has
   already moved.
2. What is left in `fjs/bnf/` — the front end, `map/rtti/`, `testlib.f.mjs` —
   moves to `fjs/grammar/bnf/` as one unit. This is the one move consumers
   outside the module see; the code importers are the `djs` tokenizer and
   parser plus their `private.ts` files, and `fjs/rtti/common`.
3. `lib/` moves to `fjs/grammar/lib/` directly, importing `../bnf` until each
   grammar is ported to `ebnf`, so the port changes imports only.
4. `fjs/grammar/ebnf/` arrives as new code
   ([ebnf-front-end](../bnf/todo/ebnf-front-end.md)).
5. The consumers migrate to `ebnf` one grammar per PR; then `fjs/grammar/bnf/`
   is deleted. `detectRepeat` stays in `data/` as the opt-in normalization for
   deserialized or hand-written rule sets.

Each `todo/` directory moves with its module, as the `basen` move did. The
issues that only concern the classical front end — `unicode-rules` above all,
since `ebnf` never has the functional string literal — go with `bnf/` and close
with it. [rule-visitor](../bnf/todo/rule-visitor.md) is about the data `Rule`
and moves to `data/todo/`.

### Tasks

- [ ] Step 0.1: extract the alphabet-neutral terminal codec from
      `fjs/bnf/module.f.mjs`; point `data`, `matcher`, `ll1`, `descent`, and
      `token_symbol` at it. The text-interpreting helpers stay put for
      [unicode-rules](../bnf/todo/unicode-rules.md) to move.
- [ ] Step 0.2: move `toData` / `toDataWithRules` / `data/private.ts` into the
      front end, with `RuleNameMap` and `GrammarData`; `repeatItem` into
      `map/rtti`.
- [ ] Step 0.3: genericize the transformer protocol over the rule identity in
      `matcher/types.ts`; check that `data/` and `matcher/` no longer import a
      front end.
- [ ] Step 0.4: backends over `RuleSet` only; `transformers` takes the grammar
      data. Re-home the functional convenience entries.
- [ ] `tsc`, `fjs t`; changelog entry marked **BREAKING CHANGES** for the
      removed backend entries.
- [ ] Move `terminal/` → `fjs/grammar/terminal/` (establishes the bucket).
- [ ] Move `data/` → `fjs/grammar/data/`, with `rule-visitor.md`.
- [ ] Move `matcher/` → `fjs/grammar/matcher/`.
- [ ] Move `ll1/`, `descent/`, `token_symbol/`, `map/types.ts` (as
      `fjs/grammar/map/`), one PR each.
- [ ] Move the rest of `fjs/bnf/` → `fjs/grammar/bnf/`; update the `djs` and
      `fjs/rtti/common` importers and every README / `todo/` link in the same
      PR.
- [ ] Move `lib/` → `fjs/grammar/lib/`.
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
  blocked on step 0 here, not on the moves.
- [rule-visitor](../bnf/todo/rule-visitor.md) — the data `Rule` visitor; the
  moved `data/` module is where it lands.
- [unicode-rules](../bnf/todo/unicode-rules.md) — already assigns
  `unicodeRange`, `unicodeMax`, `toSequence`, `str`, `set`, `range`, and
  `notSet` to the alphabet adapter, by the rule that an API interpreting text
  as code points is not core. `terminal/` is the other side of that same
  boundary and takes only what is left, so neither set of helpers moves twice.
- [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)
  — the media codecs take no runtime dependency on the grammar modules, and
  the `djs` front end moves to `fjs/fsc` as a consumer.

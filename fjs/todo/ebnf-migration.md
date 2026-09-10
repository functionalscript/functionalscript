## ebnf-migration. Build `fjs/ebnf/` beside `fjs/bnf/`, then retire `bnf/`

**Priority:** P3
**Status:** open

This replaces the retired grammar-bucket plan, which grouped the grammar
modules under a new `fjs/grammar/` and moved the live `fjs/bnf/` into it in
eight stages. There is no `fjs/grammar/`. Both plans reach the same end
state — one front end with a repetition primitive, one reference backend, no
classical `bnf/` — and this is the route. What grammar-bucket established
and no surviving file says is kept below, under "What the retired plan
established".

### Problem

The retired grammar-bucket plan moved the live `fjs/bnf/` module in eight
stages so that a second front end could share its machinery, and only then
built the second front end. Read against
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

#### What the retired plan established

Two things from grammar-bucket survive it, because the triage below rests on
them.

**The coupling inventory.** The machinery that only ever sees a `RuleSet`
still imports the classical front end today, and this is where:

- `data/` takes `oneEncode` from it, and hosts `toData` — the conversion
  *from* the functional layer — beside the IR.
- `matcher/` takes `eofSymbol`; `ll1/` and `descent/` take `rangeDecode` and
  `toData`, and each exports a convenience entry taking a functional rule.
- `token_symbol/` takes `fullRange`, `rangeDecode` and `unicodeRange`.
- Type-level, and deepest: `matcher/types.ts` spreads the functional `Rule`
  through the transformer protocol (`Entry.rule`, `TransformerMap.entries`,
  `Transformer`'s repeat arm, `TransformerTools.entry` / `repeatOf`), and
  `data/types.ts` does the same via `RuleNameMap` and `GrammarData`.
- A second coupling, to the alphabet rather than the front end:
  `matcher/types.ts`, `ll1/types.ts` and `descent/types.ts` import
  `CodePoint` and spell their public surfaces `Meta<M, CodePoint>`, so a
  backend over token symbols already contradicts its own types.

Every **move** below cuts these edges on the way in: `ebnf/` may not import
`bnf/`, so a moved module takes its terminal form from `ebnf/terminal/`, the rule
identity from the EBNF `Rule`, and its symbol type from `terminal/` rather
than from `fjs/text`.

**Membership.** A module belongs in `fjs/ebnf/` iff it defines, transforms or
executes grammars over a symbol alphabet. `fsc` is a compiler, `js/tokenizer`
a hand-written scanner and `djs` a language front end: all three are
consumers and stay out. The alphabet adapters (`unicode/`, `byte/` when it
exists) are dependencies of the front end, not parts of it.

#### Principles

1. **`fjs/ebnf/` is a new module, not a rename.** There is no `fjs/grammar/`.
   The neutral machinery lives inside `ebnf/` under the same names it has
   today (`data/`, `matcher/`, `ll1/`, `token_symbol/`), which is what
   grammar-bucket wanted from a bucket and what `bnf/` already does.
2. **Dependency direction: `bnf` may import from `ebnf`; `ebnf` never imports
   from `bnf`.** In any code form — a runtime `import`, a JSDoc `@import`,
   an `import type` in `types.ts`. A type-only dependency is exactly what
   would make `tsc` fail when `bnf/` is deleted, so it counts. A relative
   link from an `ebnf/` README or `todo/` to a `bnf/` document is a
   reference, not a dependency: it makes nothing fail, and `bnf/`'s issues
   are the record of the designs `ebnf/` replaces, which `ebnf/`'s own
   issues may cite. Stage 7 re-points or retires such links as
   [todo/README.md](../../todo/README.md) describes for retired issues.
   The rule is written down in
   [fjs/AGENTS.md](../AGENTS.md) and held by review; no new tool is added
   for it, because none the repository has can express it and a text scan
   is not analysis ([AGENTS.md §6](../../AGENTS.md#6-external-tools)). Its
   mechanical check is stage 7 itself: deleting `bnf/` fails `tsc` and the
   suite on any `ebnf → bnf` import, JSDoc `@import` included. Anyone who
   wants the check earlier may propose a parser-backed lint; that is an
   option, not a task of this plan.
3. **Triage, not copy.** Every piece of `bnf/` is assigned one of three bins
   before it is touched: **move** (taken into `ebnf/` as is or nearly so),
   **rewrite** (a new implementation in `ebnf/`, designed rather than copied),
   or **retire** (stays in `bnf/` and is deleted with it, no EBNF counterpart).
   The tables below are that assignment. A move takes nothing away from
   `bnf/`: `bnf/` keeps its copy, and whoever next touches it may repoint it
   at `ebnf/`'s when that is cheaper than keeping two — an option under
   principle 2, never a requirement. Nothing under `fjs/bnf/` is deleted or
   moved away before stage 7.

   **This migration is an opportunity to improve BNF, and nothing is copied
   blindly.** Everything is subject to rethinking on its way into `ebnf/`:
   names, algorithms, types, module boundaries, proofs. A **move** bin means
   the behaviour is worth keeping, not that the code is; the developer moving
   it is expected to read it as if reviewing it for the first time, and to
   rename, simplify or re-type what does not hold up. Where the rethinking
   turns a move into a rewrite, update the table rather than the other way
   round. The design questions ebnf-front-end leaves open are the first such
   opportunity, not the last.
4. **`bnf/` stays live, and nobody is blocked.** Using BNF, extending it and
   improving it all continue while EBNF is built; this plan puts no freeze,
   review gate or "land it in `ebnf/` first" rule on `bnf/`. The two modules
   are not kept in sync: a feature added to BNF creates no obligation to add
   it to EBNF. **It is ported when a consumer that needs it transitions**, as
   part of that consumer's port — so the porting cost is paid once, by the
   port that proves the feature is still wanted, and a feature no surviving
   consumer needs is never ported at all.

   **That is garbage collection, and it is the point.** Porting only what a
   consumer reaches is a reachability walk over the old module with the
   consumers as roots: whatever no port ever references is unreachable and
   is deleted with `bnf/` at stage 7, without anyone having to decide to
   drop it. Nothing needs a deprecation notice, a usage survey or a
   "still needed?" review — if it was needed, a port pulled it across. The
   retire bins in the triage below are the cases already known to be
   unreachable; the walk finds the rest. What `ebnf/` *starts* from —
   stages 1 to 4 below — is the triage's choice, not the walk's; the walk
   governs everything after, and since `bnf/` loses nothing before stage 7,
   every copy stays reachable from `bnf/`'s own consumers until then.

   **Moving, copying or porting a feature when it is needed is meant to be
   routine, not an event.** A feature is a function and its proof, and the
   two modules keep the same shape (front end, `data/`, `matcher/`, `ll1/`,
   `token_symbol/`, `lib/`), so a port is usually a copy into the matching
   place, a re-spelling against the EBNF `Rule`, and the proof brought along.
   A feature BNF built on machinery that already lives in `ebnf/` is mostly
   there before the port starts. If porting one turns out to be a big deal,
   that is a finding, not a cost to absorb: either the feature was built
   against the wrong layer, or the two modules have drifted further apart
   than this plan intends, and either goes into the record stage 7 writes.

   Writing something in both front ends is still welcome where it is cheap,
   because that is how EBNF's advantages and pitfalls surface (principle 5),
   but it is an option, never a requirement.
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

#### The pattern, if it works

This plan is one instance of a general way to evolve a module without
freezing it, and the point of writing the steps down is to find out whether
they hold:

1. Create a new module beside the old one.
2. Write the code there, cherry-picking from the old module what is worth
   keeping and rethinking the rest.
3. Let the old module depend on the new one, never the other way round, so
   the old one can be removed without consequences.
4. Keep the old module open for use and improvement; do not block anyone. A
   feature added to the old module is ported to the new one when a consumer
   that needs it moves, not before — and keep the two modules similar enough
   in shape that such a port is routine. What no consumer's port reaches is
   garbage, collected when the old module is retired.
5. Move the consumers one by one, porting with each the features it needs.
6. Retire the old module.

If the migration succeeds, stage 7 records the pattern in
[doc/DESIGN.md](../../doc/DESIGN.md) as a section of its own, with this
migration as the worked example and whatever the stages above taught about
it — where the direction rule had to be enforced, which moves became
rewrites, what the side-by-side proofs caught. If it fails, the same section
records why.

#### Layout

```text
fjs/ebnf/
  module.f.mjs, types.ts   the front end: Rule union with a repetition primitive
                           (and the string-taking terminal helpers: a string
                           is a Unicode sequence — unicode-rules, Amended)
  terminal/                the symbol domain, EOF, integer helpers over range_set (rewrite)
  unicode/                 text adapter: str, not, unicodeRange, …   (rewrite)
  utf16/                   the code-unit alphabet: its metadata, and a text as symbols (shipped)
  byte/                    the byte alphabet: its terminals, its metadata, and bytes as symbols (shipped)
  data/                    RuleSet IR with bounded Repeat, emptyTagMap (rewrite)
  matcher/                 cursor, EOF, AST, transformer tools       (retire, unless a second backend wants it — see the triage)
  ast/                     the typed AST with its metadata channel   (shipped)
  ll1/                     the reference backend, folding the rewrite set (rewrite — shipped)
  token_symbol/            multi-character token alphabet            (move)
  lib/                     json, datajs                              (port)
  todo/
```

The front end itself is the design in
[ebnf-front-end](../bnf/todo/ebnf-front-end.md): the `Rule` union following
RTTI, `repeat(min, max)` with `option` / `repeatFrom` / `repeatFrom0` /
`times` as partial applications — the names that shipped, not the
`repeat*Plus` pair the issue proposed
([ebnf-front-end](../bnf/todo/ebnf-front-end.md), **Amended**) — the AST as a
function of the form, `BoundedArray` from `fjs/types/array`. Its Problems 1, 3, 6, 7 and 8 are about the IR and the AST:
1, 3 and 6 are answered by [ebnf-data](../ebnf/data/README.md), the
`data/` piece, and 7 and 8 still need answers here. Problems 2 and 9 exist
only because of shared machinery and do not.

#### Module triage

| `bnf/` today | bin | in `ebnf/` |
|---|---|---|
| `module.f.mjs` — constructors, `Rule` union | rewrite | `module.f.mjs`, `types.ts`, per ebnf-front-end |
| `module.f.mjs` — `rangeEncode`, `rangeDecode`, `oneEncode`, `eof`, `fullRange` | rewrite | `terminal/` over `fjs/types/range_set` values — the domain, `eof`, `one`, `toRangeMap` ([ebnf-range-set](../bnf/todo/ebnf-range-set.md)); there is no packed codec in `ebnf/`, so `bnf` keeps its own and has nothing to repoint to. `rangeEncode` shipped in `module.f.mjs` ahead of `terminal/` existing |
| `module.f.mjs` — `set`, `range`, `remove`, `unicodeMax` | rewrite | `module.f.mjs`: the front end's rule union already reads a `string` as a Unicode sequence ([unicode-rules](../bnf/todo/unicode-rules.md), **Amended**) |
| `module.f.mjs` — `str`, `not`, `notSet`, `unicodeRange` | rewrite | `unicode/`, EBNF forms only — what the rule union does not already imply ([unicode-rules](../bnf/todo/unicode-rules.md)) |
| `data/` — `RuleSet`, `emptyTagMap`, `isRepeat` | rewrite | `data/` per [ebnf-data](../ebnf/data/README.md): every rule a tagged tuple, a range-set terminal, a `Repeat` carrying `min`/`max`. The classical `toData` output is **not** a valid EBNF set — a packed range has no reading there — so `bnf/data` cannot simply repoint its IR types; the bridge from the classical set to the EBNF one is mechanical and is `bnf/data`'s to add, under the direction rule, if the comparison proofs want it |
| `data/` — `toData`, `toDataWithRules`, `detectRepeat`, `repeatItem` | retire | the front-end lowering in `ebnf/` needs no recognition, and a hand-written or deserialized EBNF set spells the primitive; an opt-in normalizer of the right-recursive shape may be added to `ebnf/data/` by whoever wants one, but nothing plans it, and it may replace a rule only by one that sits where the original sat — `repeat(0, 0)(R)` for `[]` does not, and loses the order `Ast` is monotone in — `_Mono` in [`ebnf/ast/types.ts`](../ebnf/ast/types.ts) pins it, and a replacement takes a rule from under a repetition it refined and puts it beside that repetition, so a consumer reasoning "a narrower rule has a narrower AST" can no longer reason through it |
| `data/` — `GrammarData`, `RuleNameMap` | rewrite | the classical ones retire; the EBNF lowering returns its own map from EBNF rule identity to generated name beside the rule set and entry — the bridge the transformer protocol keys on through `Entry.rule`, and the "rule identity must survive" requirement in [ebnf-front-end](../bnf/todo/ebnf-front-end.md) — in whatever shape the `data/` rewrite chooses |
| `matcher/` | retire | **Amended.** It was to be moved with the `Rule` identity of its transformer protocol retargeted to the EBNF `Rule`. [`ebnf/ll1/`](../ebnf/ll1/README.md) shipped without it: the cursor is the backend's own, the AST is `Ast<R, I, O>` from [`ebnf/ast/`](../ebnf/ast/README.md) and needs no constructors, and the transformer protocol is the rewrite set `ll1` folds. What is left of it is shared by no one until a second backend exists, and that backend is where a `matcher/` would be extracted from `ll1/` — an option, not a task. `bnf` keeps its own copy in any case |
| `ll1/` | rewrite | [`ebnf/ll1/`](../ebnf/ll1/README.md), shipped: a `RuleSet`-only entry (`parserRuleSet`) and a front-end one (`parser`), `firstMap` refusing left recursion and a first/first conflict by name, one flat node per repetition whatever its bounds, and the AST mapping as a rewrite set folded into the parse, keyed by rule identity, with per-layer metadata — the `MI`/`MO` of [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md) as the `I` and `O` of `Ast<R, I, O>`. Not shipped: layer composition as a module, which is stage 6's; the proof's two-layer example is the pattern |
| `descent/` | retire | consumers port to `ll1/` (below) |
| `token_symbol/` | move | the layer boundary; imports `unicode/`, so it lands after it |
| `map/types.ts` | rewrite | **Amended.** A separate `ebnf/map/` shipped first — a bottom-up rewrite of `Ast<R>` values keyed by rules as the types see them — and was retired when the fold landed: the mapping is the rewrite set [`ebnf/ll1/`](../ebnf/ll1/README.md) folds, typed by the layer's metadata rather than per rule, and that README's "Why a fold" records what the rewrite cost and why. A mapping's function is typed from its rule in `tsc`, so no RTTI layer is needed |
| `map/rtti/` | retire | its runtime check of a mapping's declared input is done by `tsc`, the mapping's parameter typed from its rule under the layer's metadata, so [rename-check-map](../bnf/map/rtti/todo/rename-check-map.md) has nothing to rename in `ebnf/`; it retires with `bnf/`. A build-time check of the alphabets, for a set assembled at runtime, is [mapping-precheck](../ebnf/ll1/todo/mapping-precheck.md) |
| `lib/json`, `lib/datajs` | port | one PR for both; `join` (was `commaJoin0Plus`) changes the AST of both bracket pairs |
| `testlib.f.mjs` — `showAst` and the root `private.ts` typing it | retire | **Amended.** It was to be moved for `ll1`'s proofs, which spell `Ast<R, I>` trees directly instead — the tree is data, so it is pinned as data |
| `testlib.f.mjs` — `classic`, `deterministic` | retire | `ebnf/lib` is its own fixture |
| `README.md` | split | the AST contract, "Terminals and EOF", "Dispatch" go to `ebnf/` and its owners; the functional representation stays and dies with `bnf/` |

No `fjs/bnf/…` path is deleted before stage 7, and nothing is required of
`bnf/` when a piece of it is moved: it keeps its copy, its exports and its
consumers, `fjs/djs` included, exactly as they are until each consumer's own
port. Repointing a `bnf/` module at its `ebnf/` counterpart is allowed by
principle 2 and worth doing when it removes a second copy someone would
otherwise maintain, and it is never a precondition for anything. So the only
breaking change to `fjs/bnf/` paths is stage 7, which declares
`**BREAKING CHANGES:**` in its `Changelog:` section
([changelog/RELEASE.md](../../changelog/RELEASE.md)). A consumer's port may
change that consumer's own public API where it had exposed the backend it is
leaving (the djs tokenizer does; stage 6 names the exports), and declares
that in its own PR. Work outside `bnf/` that this plan pulls in declares its
own too: replacing `fjs/types/range_set`'s representation
([ebnf-range-set](../bnf/todo/ebnf-range-set.md)) is a breaking PR before
stage 7 and says so in its own `Changelog:` section.

#### Consumer port

Outside `fjs/bnf` the front end has exactly five consumers, all under
`fjs/djs`. Each port carries with it whatever BNF gained since `ebnf/` was
started that the consumer relies on (principle 4). The consumers are named
by today's paths: [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)
renames the tokenizer and parser to `fjs/fsc/` as a rename with the BNF
dependency intact, and if that lands first the port simply follows them
there. Nothing here orders the two plans either way. In dependency order:

1. `bnf/lib/json` and `bnf/lib/datajs` — atomically, since `testlib`'s
   `deterministic()` delegates to `lib/json`. The originals stay in `bnf/`.
2. `fjs/djs/tokenizer` — depends on `data/`, `ast/` and `ll1/` (the tree,
   its mapping, and a parser resumable at an index), and on the metadata
   channel of [`ebnf/ast/`](../ebnf/ast/README.md) for the positions it
   reports. Not on `unicode/` or `terminal/`: its complements are spelled
   with `remove` over the full range, as its grammar
   [`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs) shows, so stage 3 did
   not gate the port.
3. `fjs/djs/parser` — the above plus `token_symbol/`.

**Neither djs grammar is LL(1) as spelled.** An earlier measurement here
ran both through the classical `dispatchMap` and found three first/first
conflicts: the parser's statement terminator, whose branches both begin
with trivia, and in the tokenizer the `*` shared by `end` and `more` of a
block comment and the shared prefixes of the punctuator list. `dispatchMap`
has no first/follow check, and `ebnf/ll1` does, so measured against the
backend the port moves to — the classical set bridged to the EBNF form, as
[ebnf-data](../ebnf/data/README.md) describes, and every rule's closure
run through `parserRuleSet` — the two grammars refuse in **eight** shapes:
those three, the `/` shared by a comment and the division operator, the
tokenizer's `numError` poison branch, the whole-file
`repeat0Plus(token)` (a greedy token against the token after it, which
vanishes with the entry a single token), and in the parser the trailing
comma and the module's final optional `;`. The table, the classification
and what each needed, measured before the port and kept here as its record
(the port's own issue file closed with the port):

| grammar | rule | refusal | class |
|---|---|---|---|
| tokenizer | `multilineContent`: `end: ['*', '/']` beside `more: [char, …]` | first/first on `*` | grammar: left-factor the `*` |
| tokenizer | the `operator` variant, 56 literals | first/first on `=`, and on every shared prefix behind it | grammar: a prefix tree, built from the list — `literals` in `fjs/ebnf` |
| tokenizer | the `token` variant: `comment`, `['/', { oneline, multiline }]`, beside `operator`, which holds `/` and `/=` | first/first on `/` | grammar: left-factor the `/`, the shape of the `*` above. Not removed by the prefix tree — checked with the operator's first set kept whole — and masking a rule by replacement erased `/` from that set, which is how the first count missed it |
| tokenizer | `number`: `digits0`, then the `option({ bigint, frac })` | first/follow on the digits, and on `e`, `E`, `n` | the `numError` poison: `[idChar]` follows every optional part of a number, and `idChar` holds digits and letters. The number boundary is decided one layer up, over the token stream |
| tokenizer | `jsGrammar = repeat0Plus(token)`: the `idChar` repeat of `id`, the body of a `//` comment, its `option(newLine)`, the number's `{ numError: [idChar], ok: none }` itself, its `fracPart` on `.`, the exponent's sign option on `+` and `-`, and `multilineContent` | first/follow on the next token's first set | inherent to a whole-file grammar: a greedy token against the token after it. With the entry a single `token` the seven vanish — verified on the bridged set and on a two-rule grammar. The poison is the row above seen from outside the number: nullable, so its follow set is the next token's |
| parser | `statementEnd`: `[trivia, ';', …]` beside `[lineTrivia, 'nl', …]` | first/first on the trivia symbols | trivia leads both branches. Trivia follows every token instead, and `;` ends every statement — the newline terminator is gone, the design [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)'s stage 5 decided |
| parser | `delimited`: `repeat0Plus([',', trivia, element, trivia])` then `option([',', trivia])`, once for arrays and once for objects | first/follow on `,` | the trailing comma, which rested on a failed round rewinding; spelled right-recursively, `item t [ ',' t [ items ] ]` |
| parser | the module's final `{ semicolon: [trivia, ';'], none: [] }`, then `trivia` | first/follow on the trivia symbols | trivia leads the option and follows it; gone with the `;` after every statement |

The measurement: the classical `RuleSet` bridged to the EBNF form, every
rule's closure run through `parserRuleSet`, each conflict masked once found
so the next surfaced.

So the djs port is a grammar rewrite plus a backend swap, not a swap alone,
and the tokenizer also needs a token layer: a parser resumable at an index
— shipped, the loop over it being the consumer's — since a whole-file token
grammar is not LL(1) under a first/follow check. Maximal munch inside a token comes for free — an
optional round starts whenever the lookahead is in the item's first set —
once the punctuators are a prefix tree that a helper builds from the list.
The conflicts are where EBNF's `option` as a bounded repeat with a flat AST
gets its first real test, so they belong in the comparison proofs before the
consumers move.

#### Issue triage

`fjs/bnf/todo/` holds twenty-two issues and `fjs/bnf/map/rtti/todo/` one. An
issue goes where the code it describes goes, and one that describes only
retired code retires with it. Moved issues have their `descent` references
rewritten against the surviving backend as they move.

| issue | bin | destination |
|---|---|---|
| [ebnf-front-end](../bnf/todo/ebnf-front-end.md) | absorb | its design becomes `fjs/ebnf/README.md` as stage 1 ships; every problem still open then — 1, 3, 4, 5, 6, 7 and 8 at the time of writing — moves to `ebnf/todo/` as one issue each, or is answered in the README |
| terminal-range-shared-type | retired | deleted by the PR that filed [ebnf-range-set](../bnf/todo/ebnf-range-set.md), with its reason recorded here: it asked for one `TerminalRange` declaration shared by `bnf/` and `bnf/data`, owned by the codec's module; `ebnf/` has no `TerminalRange` and no codec — its terminal is a range set — so there is nothing to declare once, and `bnf/`'s two declarations stay and go with `bnf/` at stage 7 |
| [unicode-rules](../bnf/todo/unicode-rules.md) | move | `ebnf/unicode/todo/` until stage 3 implements it |
| rule-visitor (retired; shipped as `matchRule` in [`fjs/ebnf/data`](../ebnf/data/module.f.mjs)), [665-bnf-data-fold-children](../bnf/todo/665-bnf-data-fold-children.md) | absorb | inputs to the `data/` rewrite (stage 2): the visitor is `matchRule`, and the child fold is one immutable `reduce` in `toData` from the start; 665 stays `bnf/`'s own issue, since it describes `bnf/data`'s code |
| [042-mixing-serializable-bnfs](../ebnf/data/todo/042-mixing-serializable-bnfs.md) | move | `ebnf/data/todo/` — done |
| [bigint-symbols](../bnf/todo/bigint-symbols.md), [terminal-range-representation](../bnf/todo/terminal-range-representation.md), [eof-as-ordinary-symbol](../bnf/todo/eof-as-ordinary-symbol.md) | move | `ebnf/terminal/todo/` |
| [utf8-token-symbols](../bnf/todo/utf8-token-symbols.md), [tokens-with-extra-information](../bnf/todo/tokens-with-extra-information.md) | move | `ebnf/token_symbol/todo/` |
| [207-bnf-semantic-actions](../bnf/todo/207-bnf-semantic-actions.md), [layered-parser](../bnf/todo/layered-parser.md), [parser-structure](../bnf/todo/parser-structure.md) | move | `ebnf/todo/` — they describe the reference backend and its protocol |
| [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md), [043-stateful-parser](../bnf/todo/043-stateful-parser.md) | keep | the classical backend's metadata protocol; for `ebnf/` that protocol is superseded by the rewrite set [`ebnf/ll1/`](../ebnf/ll1/README.md) folds over the metadata channel of [`ebnf/ast/`](../ebnf/ast/README.md), which each cites at its head. 043's streaming input — a parser as a `StateFold` over one symbol at a time — is not superseded and stays open for `ebnf/` |
| [recognizer-backend](../bnf/todo/recognizer-backend.md), [032-stupid-parser](../bnf/todo/032-stupid-parser.md), [046-lr1-parser](../bnf/todo/046-lr1-parser.md) | move | `ebnf/todo/` — backends that do not exist yet, created at their final paths |
| [proof-recognizer-and-fixtures](../bnf/todo/proof-recognizer-and-fixtures.md), [serialized-proof-expectations](../bnf/todo/serialized-proof-expectations.md) | move | `ebnf/todo/`, rewritten for one backend |
| [bnf-grammar-single-owner](../bnf/todo/bnf-grammar-single-owner.md) | move | `ebnf/lib/todo/` at stage 5 |
| [rename-check-map](../bnf/map/rtti/todo/rename-check-map.md) | retire | `ebnf/` has no `checkMap`; the issue describes `bnf/map/rtti`'s code and goes with it |
| grammar-bucket | retired | deleted by the PR that filed this issue; every issue that cited its stages now cites the stages here, and the "Later candidates" bullet of [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md) names this plan and `fjs/ebnf/` |

#### Stages

Every stage is additive, `bnf/` loses nothing until stage 7, and `tsc` and
`fjs t` pass at each. **The stages are numbered for reference, not for
order, and they prescribe no method.** The only constraints are the
dependencies each module names in the layout — `ll1/` needs `data/` and
`map/`, a ported grammar needs whatever it imports, a deleted `bnf/` needs
no consumer left on it; `token_symbol/` needs nothing, its `0x110000`
start being its own, and reading that from `unicode/` is a repoint
[unicode-rules](../bnf/todo/unicode-rules.md) tracks for after stage 3 — and
the direction rule. Any order, overlap, split or merge of the stages that
respects those is the developer's choice, and so is how each piece is
built: whether a "move" is a copy, a re-export or a rewrite, whether an
issue is absorbed or moved, whether a stage is one PR or five. Where the
text below says "stage N" it names a piece of work, not a point in time.
Issues outside this file cite the piece by name (`ebnf/terminal/`, "the
consumer port"), never by number, so a renumbering here cannot strand them.

0. **Adopt.** Retire grammar-bucket — done in the PR that filed this issue:
   the file is deleted and every citation of its stages repointed here. Add
   one sentence to [fjs/AGENTS.md](../AGENTS.md) stating the direction
   (principle 2), which is all the enforcement this plan asks for.
1. **`ebnf/terminal/` and the front end.** Write `ebnf/terminal/` over
   `fjs/types/range_set` — the symbol domain, `eof`, the integer helpers and
   `toRangeMap`, per [ebnf-range-set](../bnf/todo/ebnf-range-set.md) — with
   its proof; there is no packed codec to copy, and `bnf/` keeps its own
   untouched. Land `ebnf/types.ts` and `ebnf/module.f.mjs` per
   ebnf-front-end. Its open problems are answered by
   whoever needs the answer, when they need it, in `ebnf/README.md` or in
   the issue: a design settled on paper before any code exists is the
   grammar-bucket way, and this plan prefers a recorded answer that the
   next stage may revise over a prerequisite that blocks the first. What
   is required is only that an answer, once relied on, is written down
   where the code that relies on it can point to it. `BoundedArray` is in
   `fjs/types/array` already.
2. **`ebnf/data/`.** The IR with a bounded `Repeat`, `emptyTagMap`, and the
   lowering from the EBNF front end, which returns the identity-to-name map
   AST mapping needs beside the rule set and entry — designed in
   [ebnf-data](../ebnf/data/README.md). `bnf/data` keeps its own IR,
   since the classical output is not a valid EBNF set (ebnf-data, "What
   differs"), and may add the bridge that issue describes — that would be
   the first `bnf → ebnf` edge — while keeping `toData`, `detectRepeat` and
   `repeatItem` as its own either way.
3. **`ebnf/unicode/`.** The text adapter in EBNF forms, before anything that
   imports it. `ebnf/byte/`, the other half of unicode-rules, has the same
   owner and was to land whenever its first consumer wanted it — shipped as
   [`ebnf/byte/`](../ebnf/byte/README.md) for
   [git-objects](../../todo/git-objects.md), ahead of `unicode/`, since it
   depends on nothing this stage adds. `ebnf/matcher/` was this stage's too, and is
   no longer anyone's: the backend shipped without it (the triage's
   `matcher/` row, **Amended**).
4. **`ebnf/token_symbol/` and `ebnf/ll1/`.** `token_symbol` moved —
   shipped as [`ebnf/token_symbol/`](../ebnf/token_symbol/README.md), a
   symbol being a rule and the start `0x110000` spelled there; having it
   read that from `ebnf/unicode/` is the repoint
   [unicode-rules](../bnf/todo/unicode-rules.md) tracks, after stage 3,
   which nothing waits on. `ll1` rewritten against
   the new IR — shipped as [`ebnf/ll1/`](../ebnf/ll1/README.md): flat nodes
   for every bound, a conflict error that names the rule, and the AST
   mapping as a rewrite set folded into the parse. Of the two things the
   backend could owe a mapping — `Ast<R>` values for a separate rewrite to
   take, or its own fold, building no tree — it shipped the values first,
   with `ebnf/map/` as the rewrite, and then the fold, which retired the
   rewrite (the triage's `map/types.ts` row, **Amended**). Metadata per the
   moved issues shipped with the fold, as the `I` and `O` of
   [`ebnf/ast/`](../ebnf/ast/README.md)'s `Ast<R, I, O>`.
5. **`ebnf/lib/` and the comparison proofs.** Port `json` and `datajs` in one
   PR — the *port*, meaning the change that stops `bnf/lib/datajs` importing
   `bnf/lib/json`. An ebnf spelling written beside the untouched classical
   grammar carries none of that risk and may land alone
   ([ebnf-front-end](../bnf/todo/ebnf-front-end.md)). Add the cross-front-end proof group: each `lib/` grammar in both
   spellings, same `RuleSet` where the constructors are shape-preserving, same
   AST otherwise, with the differences ebnf-front-end predicts pinned
   explicitly (`option`, `repeatFrom(1)`, `join`).
6. **Layered LL(1) and the djs port.** Done. The token layer — the
   resumable parser — and the prefix-tree helper `literals`; the eight
   conflicts above resolved in the grammars
   [`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs) and
   [`fjs/djs/parser/grammar`](../djs/parser/grammar/module.f.mjs);
   `djs/tokenizer` reading the one-token grammar through the resumed
   parser with the trivia merge and the number boundary as a fold above
   it, and `djs/parser` reading the module grammar through a rewrite set —
   a node per value, a record per statement — with the names resolved
   above, on the pattern of [`media/datajs`](../media/datajs/parser/module.f.mjs).
   `bnf/descent` has no consumer outside `fjs/bnf`. The parser port carried
   the breaking change the terminator row above names: `;` ends every
   statement and a newline does not, and `djs/serializer` writes it.

   The djs tokenizer's public exports that exposed the descent backend —
   `jsGrammar`, `jsMatcher`, which built a `descentParserRuleSet`, and
   `descentParserCpOnly`, which returned a `DescentMatchResult` — were the
   port's to retire, and it did, with no LL(1) equivalents: the grammar is
   [`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs) and a consumer that
   wants it imports it there. Their only importer was the tokenizer's own
   proof, updated in the same PR. That was a change to `fjs/djs/tokenizer`'s
   own public API and the port declared it as such; the "one breaking
   change" above is a statement about `fjs/bnf/` paths, not about a
   consumer's surface where it had exposed the backend it left.
7. **Delete `fjs/bnf/`.** With it: the retired issues, `descentEquivalence` in
   its two-backend form, and the classical half of the README split. Finish
   the issue moves, each taking its inbound links with it. Repoint every
   other inbound reference from outside `fjs/bnf/` — Markdown links and
   roadmap prose alike, `nanvm-lib/todo/mvp-roadmap.md` and
   `spec/todo/3360-type-annotations.md` among a couple of dozen files today —
   at `fjs/ebnf/` or at whatever replaced the target. Neither `tsc` nor the
   suite reads Markdown, so the deletion PR finds them by search. One
   `**BREAKING CHANGES:**` declaration.

### Tasks

- [x] Stage 0: grammar-bucket retired; its citations repointed; the group-fs
      bullet rewritten.
- [ ] Stage 0: the direction sentence in `fjs/AGENTS.md`.
- [ ] Stage 1: `ebnf/terminal/` with proof; `ebnf/types.ts` and
      `ebnf/module.f.mjs` with proof; ebnf-front-end's open problems
      answered as they are needed, in `ebnf/README.md`.
- [x] Stage 2: `ebnf/data/` with bounded `Repeat` and proof, per its
      [README](../ebnf/data/README.md); rule-visitor absorbed, 042 moved,
      665 left with `bnf/data`.
- [ ] Stage 3: `ebnf/unicode/` with proof; unicode-rules' `unicode/` half
      settled, its `byte/` half shipped as `ebnf/byte/`.
      `ebnf/matcher/` and `showAst` retired from the stage (**Amended**).
- [x] `ebnf/ast/` with the metadata channel, and `ebnf/ll1/` folding the
      rewrite set keyed by rule identity, with proof; `ebnf/map/`, the
      separate rewrite that shipped first, retired by it;
      rename-check-map retired with `bnf/map/rtti`.
- [x] Stage 4: `ebnf/ll1/` with proof; the backend's side of the AST
      mapping.
- [x] Stage 4: `ebnf/token_symbol/` with proof; its start is its own
      until [unicode-rules](../bnf/todo/unicode-rules.md)'s repoint.
- [ ] Stage 5: `ebnf/lib/json` and `ebnf/lib/datajs` with proofs; the
      cross-front-end comparison proof group; bnf-grammar-single-owner moved.
- [x] Stage 6: the token layer; the djs tokenizer grammar made LL(1) and
      the tokenizer ported; the parser grammar made LL(1) and the parser
      ported; the descent backend without consumers.
- [ ] Stage 7: delete `fjs/bnf/`; move the remaining issues; split the README;
      repoint every inbound link and reference from outside `fjs/bnf/`.
      `**BREAKING CHANGES:**`.
- [ ] Stage 7: record the pattern above in `doc/DESIGN.md`, with this
      migration as the worked example and what it taught.
- [ ] `tsc`, `fjs t` at every stage; every new `.f.mjs` ships 100% co-located
      proof coverage ([fjs/AGENTS.md](../AGENTS.md)).

### Related

- [ebnf-front-end](../bnf/todo/ebnf-front-end.md) — the front-end design this
  plan builds at stage 1; its Problems 2 and 9 dissolve here.
- [layered-parser](../bnf/todo/layered-parser.md),
  [207-bnf-semantic-actions](../bnf/todo/207-bnf-semantic-actions.md) — what
  the reference backend grows into, in `ebnf/ll1/` (stage 4) and the
  layered port (stage 6).
- [generic-parser-metadata](../bnf/todo/generic-parser-metadata.md) — the
  classical metadata protocol, superseded for `ebnf/` by the metadata
  channel of [`ebnf/ast/`](../ebnf/ast/README.md) and the rewrite set
  [`ebnf/ll1/`](../ebnf/ll1/README.md) folds; kept as the record of what
  it replaces.
- [unicode-rules](../bnf/todo/unicode-rules.md) — stage 3, EBNF representation
  only.
- [group-fs-subdirectories-by-concern](./group-fs-subdirectories-by-concern.md)
  — the regrouping plan this belongs to; its "Later candidates" bullet names
  this plan.

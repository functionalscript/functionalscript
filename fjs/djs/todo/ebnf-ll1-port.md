## ebnf-ll1-port. Port the tokenizer and the parser from `bnf/descent` to `ebnf/ll1`

**Priority:** P3
**Status:** open

### Problem

[`../tokenizer`](../tokenizer/module.f.mjs) and [`../parser`](../parser/module.f.mjs)
are the last two consumers of `fjs/bnf` outside that module: `media/json`
([#1910](https://github.com/functionalscript/functionalscript/pull/1910)) and
`media/datajs`
([#1911](https://github.com/functionalscript/functionalscript/pull/1911))
already read their formats through an `fjs/ebnf` grammar folded by the LL(1)
backend. Both djs modules run the backtracking `bnf/descent` backend, and
[ebnf-migration](../../todo/ebnf-migration.md) cannot delete `fjs/bnf/`
(its stage 7) until they have moved — its stage 6, "the djs port". This issue
is that stage's co-located file: what the port needs, measured against the
backend it moves to.

**Neither grammar is LL(1) as spelled, and the earlier count was low.**
ebnf-migration measured three conflicts with the classical `dispatchMap`,
which checks first/first only. The EBNF backend also refuses first/follow
conflicts ([`ebnf/ll1`](../../ebnf/ll1/README.md), "What is refused"), and
measured with it — the classical `RuleSet` bridged to the EBNF form as
[`ebnf/data`](../../ebnf/data/README.md) describes, `parserRuleSet` run over
every rule's closure, each conflict masked once found so the next surfaces —
the two grammars refuse in eight distinct shapes:

| grammar | rule | refusal | class |
|---|---|---|---|
| tokenizer | `multilineContent`: `end: ['*', '/']` beside `more: [char, …]` | first/first on `*` | grammar: left-factor the `*` |
| tokenizer | the `operator` variant, 56 literals | first/first on `=`, and on every shared prefix behind it | grammar: a prefix tree, built from the list |
| tokenizer | the `token` variant: `comment`, `['/', { oneline, multiline }]`, beside `operator`, which holds `/` and `/=` | first/first on `/` | grammar: left-factor the `/`, the shape of the `*` above. Not removed by the prefix tree — checked with the operator's first set kept whole — and masking a rule by replacement erased `/` from that set, which is how the first count missed it |
| tokenizer | `number`: `digits0`, then the `option({ bigint, frac })` | first/follow on the digits, and on `e`, `E`, `n` | the `numError` poison: `[idChar]` follows every optional part of a number, and `idChar` holds digits and letters |
| tokenizer | `jsGrammar = repeat0Plus(token)`: the `idChar` repeat of `id`, the body of a `//` comment, its `option(newLine)`, the number's `{ numError: [idChar], ok: none }` itself, its `fracPart` on `.`, the exponent's sign option on `+` and `-`, and `multilineContent` | first/follow on the next token's first set | inherent to a whole-file grammar: a greedy token against the token after it. With the entry a single `token` the seven vanish — verified on the bridged set and on a two-rule grammar. The poison is the row above seen from outside the number: nullable, so its follow set is the next token's. `multilineContent`'s shows only once its own `*` first/first is left-factored, since the analysis reports that before it reaches the follow check |
| parser | `statementEnd`: `[trivia, ';', …]` beside `[lineTrivia, 'nl', …]` | first/first on the trivia symbols | trivia leads both branches |
| parser | `delimited`: `repeat0Plus([',', trivia, element, trivia])` then `option([',', trivia])`, once for arrays and once for objects | first/follow on `,` | the trailing comma, which today rests on a failed round rewinding |
| parser | the module's final `{ semicolon: [trivia, ';'], none: [] }`, then `trivia` | first/follow on the trivia symbols | trivia leads the option and follows it |

Beside the grammars, three things the port relies on are not in `fjs/ebnf`:

- **A parser resumable at an index** — shipped: `Parser` takes a `start`
  index and reports the input's own indices
  ([`ebnf/ll1`](../../ebnf/ll1/README.md), "A token layer resumes the
  parser"). A token layer over a single-token grammar parses the next token
  *from where the last one ended*, and the loop is the consumer's; slicing
  the input per token would be quadratic, and so would a whole-input symbol
  scan per match, which is why a symbol is now checked where it is read.
  This is the "token layer" of ebnf-migration's stage 6 made concrete.
  Maximal munch inside a token needs no mechanism of its own — an optional
  round starts whenever the lookahead is in the item's first set, so
  identifiers, comments and numbers are munched maximally by construction,
  and operators are once they are a prefix tree.
- **`ebnf/token_symbol/`** — the parser's alphabet comes from
  [`bnf/token_symbol`](../../bnf/token_symbol/module.f.mjs). A move, as
  ebnf-migration triages it: symbols there are any non-negative safe
  integers, so the encoding keeps its `0x110000` start and gains capacity.
- **`not`, `notSet`, `unicodeRange`** — the tokenizer's complements. No
  `ebnf/unicode/` is needed for them: `remove(range('\0' + unicodeMax), set(…))`
  spells each, and the alphabet stays code points, which is what the
  tokenizer's positions and ranges are written over (the media readers use
  UTF-16 units; the backend accepts either).

The fold changes shape with the backend. Today both modules read the descent
AST by *tag* — `getTokensFromAstRule`, `filterFunc`, `scanFunc` and the
trivia merge in the tokenizer, `slot`, `descendantsTagged` and the
positional root read in the parser — and their proofs pin those tags and
shapes. Under the rewrite set a token rule's mapping returns the token,
lexeme and start position included, as
[`media/json/parser`](../../media/json/parser/module.f.mjs) does with
`lexeme`; the unterminated-comment and malformed-number errors become error
tokens the mapping returns, anchored where they are anchored today. The
parser's `foldModule`/`foldValue` — bind before value, one map for `import`
and `const`, `__proto__` by spelling, an explicit stack — is the design
[`media/datajs/parser`](../../media/datajs/parser/module.f.mjs) already
implements over the EBNF backend, so the parser port is that reader widened
to imports, identifier keys and trivia rather than a fresh fold.

### Proposal

Two ports, tokenizer first, each a grammar rewrite plus a backend swap:

1. **Tokenizer.** Left-factor `*` in the block comment and `/` out of
   `comment` and `operator`; build the operator prefix tree from the
   literal list with `literals` in `fjs/ebnf`; drop the `numError`
   poison and decide the number boundary in the layer above the tokens —
   a number or bigint token directly followed by a token that begins with
   an identifier character or a digit, no trivia between, is the error
   `123abc`, `1nabc`, `1n0`, `123true` and `00` are today; at that layer a
   keyword is an `id`, so the following token is an identifier, a number or
   a bigint — and the token stream shows it to an LL(1) grammar or a
   mapping over that stream, never to hand-written scanning in the loop;
   spell the grammar as one `token` and run it through the resumable
   parser. Every layer is an LL(1) grammar and a mapping into the next
   alphabet; nothing else parses. Write the EBNF spelling beside
   the classical one first and pin the same token stream over the existing
   proof corpus (ebnf-migration, principle 5), then swap. `jsMatcher` and
   `descentParserCpOnly` are the descent-shaped exports the port replaces;
   only the proof imports them, and the PR declares the change.
2. **Parser.** Trivia *follows* a token instead of leading a rule, as
   [`ebnf/lib/json`](../../ebnf/lib/json/module.f.mjs)'s `cj` and
   [`ebnf/lib/datajs`](../../ebnf/lib/datajs/module.f.mjs)'s `statement`
   lay it out. The trailing comma is spelled right-recursively —
   `list = [item, option([',', ws, option(list)])]`, the same language, one
   lookahead — or, better, becomes the first consumer of the separated
   repeat [`ebnf/data`](../../ebnf/data/README.md) leaves room for. The
   terminator: [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)'s
   stage 5 drops the newline terminator for `;`, which removes the two
   trivia conflicts outright; landing the port after stage 5, or in it, is
   cheaper than left-factoring a terminator that is being retired
   (`[lineTrivia, { semi: [';', trivia], nl: ['nl', trivia, option([';', trivia])] }]`
   accepts the same language if it must land first).

Size, from the `media/datajs` port: ~1,100 lines added for a 97-line
grammar, the proof half of it. The tokenizer is 726 lines with a 1,051-line
proof and the parser 838 with 1,170, and both proofs pin the descent AST, so
expect each port to rewrite its proof rather than adjust it.

Nothing else in the repository parses with `fjs/bnf`. The remaining
hand-written readers are outside this issue: `fjs/js/tokenizer` (751 lines,
whose runtime importers are this tokenizer's `isKeywordToken` and
`mergeTrivia`, and `fjs/media/json/tokenizer`, which no module imports since
#1910) retires with the restructure plan's stage 7, and `fjs/rtti/parse`
reads values, not text.

### Tasks

- [x] `ebnf/ll1`: a parser resumable at an index, with proof; the loop over
      it is the consumer's, as that module's README says.
- [ ] `ebnf/token_symbol/` moved, with proof; ebnf-migration's stage 4 half
      ticked.
- [x] `literals`, the prefix tree over a word list, in `fjs/ebnf` with
      proof; the punctuators of JavaScript build as one LL(1) rule.
- [x] Tokenizer grammar in EBNF beside the classical one, LL(1), with the
      comparison proof: [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs),
      and the `ebnf` group of the classical tokenizer's proof.
- [x] Tokenizer on `ebnf/ll1`: the grammar read one token at a time, the
      trivia fold, the boundary check and the error tokens one layer up;
      `jsGrammar`, `jsMatcher` and `descentParserCpOnly` retired and
      declared. The comparison proof retired with the classical grammar;
      the tokenizer's corpus stands unchanged as the port's proof.
- [ ] Parser grammar LL(1): trailing trivia, right-recursive or separated
      list, the terminator per stage 5.
- [ ] Parser on `ebnf/ll1`, on the `media/datajs` reader pattern.
- [ ] ebnf-migration stage 6 ticked; `bnf/descent` without consumers.

### Related

- [ebnf-migration](../../todo/ebnf-migration.md) — stage 6 is this issue;
  its consumer-port table now cites the measurement above.
- [`ebnf/ll1/README.md`](../../ebnf/ll1/README.md) — the refusals the table
  is measured against.
- [layered-parser](../../bnf/todo/layered-parser.md) — maximal munch as the
  one mechanism a token layer adds; the resumable parser is where it lands.
- [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
  — stage 5 renames these modules to `fjs/fsc` and drops the newline
  terminator; either order works, and the terminator decides which is cheaper.
- [043-stateful-parser](../../bnf/todo/043-stateful-parser.md) — the
  streaming form of the same token layer, not required here.

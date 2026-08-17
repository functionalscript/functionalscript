# BNF, describing itself

[./module.f.mjs](./module.f.mjs) is the original Backus-Naur Form metasyntax —
`<rule-name> ::= <expression>` — written as a grammar in this package's own
[functional representation](../README.md#functional-representation). It is a
transcription of the canonical BNF-of-BNF example:
https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form#Further_examples

```text
<syntax>         ::= <rule> | <rule> <syntax>
<rule>           ::= <opt-whitespace> "<" <rule-name> ">" <opt-whitespace> "::="
                       <opt-whitespace> <expression> <line-end>
<opt-whitespace> ::= " " <opt-whitespace> | ""
<expression>     ::= <list> | <list> <opt-whitespace> "|" <opt-whitespace> <expression>
<line-end>       ::= <opt-whitespace> <EOL> | <line-end> <line-end>
<list>           ::= <term> | <term> <opt-whitespace> <list>
<term>           ::= <literal> | "<" <rule-name> ">"
<literal>        ::= '"' <text1> '"' | "'" <text2> "'"
<text1>          ::= "" | <character1> <text1>
<text2>          ::= "" | <character2> <text2>
<character>      ::= <letter> | <digit> | <symbol>
<letter>         ::= "A" | "B" | ... | "Z" | "a" | "b" | ... | "z"
<digit>          ::= "0" | "1" | ... | "9"
<symbol>         ::= "|" | " " | "!" | "#" | "$" | "%" | "&" | "(" | ")" | "*"
                    | "+" | "," | "-" | "." | "/" | ":" | ";" | ">" | "="
                    | "<" | "?" | "@" | "[" | "\" | "]" | "^" | "_" | "`"
                    | "{" | "}"
<character1>     ::= <character> | "'"
<character2>     ::= <character> | '"'
<rule-name>      ::= <letter> | <rule-name> <rule-char>
<rule-char>      ::= <letter> | <digit> | "-"
```

`syntax` is the entry rule: one or more `rule` productions, each of the shape
`<name> ::= alternative (| alternative)*`, where an alternative is a
whitespace-separated list of terms, and a term is either a quoted literal or a
`<name>` reference to another rule.

## Adapting the grammar to a greedy, ordered-choice matcher

This package's backends ([../ll1/](../ll1/), [../descent/](../descent/)) are
LL(1) / recursive descent: alternatives are tried in order, and the first one
that succeeds and consumes input wins, with no backtracking into a later
alternative that could have matched more (PEG-style ordered choice). Three
things in the canonical grammar don't survive that translation unchanged:

- **Left recursion.** `<rule-name> ::= <letter> | <rule-name> <rule-char>` is
  left-recursive, which a recursive descent matcher cannot follow at all — it
  would recurse into `ruleName` before consuming anything. Rewritten as
  `<letter> <rule-char>*` (`ruleName` in [./module.f.mjs](./module.f.mjs)),
  which accepts the same language.
- **Right recursion, reordered.** `<line-end> ::= <opt-whitespace> <EOL> |
  <line-end> <line-end>` becomes one or more repetitions of `<opt-whitespace>
  <EOL>` (`lineEnd`, via `repeat1Plus`). Separately, `<expression> ::= <list>
  | <list> "|" <expression>` and `<list> ::= <term> | <term> <list>` each list
  their short alternative first in the original; here the alternative that
  keeps consuming (`or` / `more`) is tried first instead, matching the
  convention `option`/`repeat0Plus` already use elsewhere in this package.
  Otherwise the short alternative would win as soon as it matches — which is
  always, since it's a prefix of the long one — and a `expression`/`list`
  with more than one item would never be reached.
- **The quote characters in `<symbol>`.** The canonical `<symbol>` includes
  both `'` and `"`. Fed into an ordered-choice matcher, that makes
  `<character>` match either quote — tried before `character1`/`character2`'s
  own dedicated quote branch — so a quoted literal's `text1`/`text2` would
  swallow its own closing quote as content and never find where to stop. Both
  quotes are left out of `symbol` here and added back only by the
  `character1` / `character2` rule that needs each one — which is what those
  two rules already exist to do.

All three rewrites accept exactly the same language as the rule they replace.

## Trying it

```js
import { toData } from '../data/module.f.mjs'
import { descentParser } from '../descent/module.f.mjs'
import { syntax } from './module.f.mjs'

const [, entry] = toData(syntax)
const match = descentParser(syntax)
// match(entry, codePoints) — see ../descent/README.md for the input shape
```

See [./proof.f.mjs](./proof.f.mjs) for worked examples, including grammar
fragments the rules reject (a missing `::=`, an unterminated rule, a
nameless `<>`).

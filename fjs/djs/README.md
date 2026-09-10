# DJS, Data JS or DataScript

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## AST

A DJS module parses into [ast/module.f.mjs](./ast/module.f.mjs); the types
in [ast/types.ts](./ast/types.ts) carry the shape and its invariants.

Why a flat list of constants with index references, rather than a value tree:
a DJS module denotes a **graph**, and `import` and `const` are how it names
the shared parts. Deserializing has to preserve that sharing — two properties
holding the same reference must yield the same object, not two equal copies —
so the AST keeps the constants addressable and refers to them by index
instead of inlining them. That is also what makes serialization a real
choice: a value referenced more than once is emitted as a `const` and reused.
See [examples/input.f.mjs](./examples/input.f.mjs).

## Both grammars are LL(1)

The tokenizer's grammar, [`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs),
and the parser's, [`parser/grammar`](./parser/grammar/module.f.mjs), are read
by [`fjs/ebnf/ll1`](../ebnf/ll1/README.md), which refuses a grammar that one
symbol of lookahead cannot decide, before any input. The classical grammars
they replaced were read by a backtracking backend, and neither was LL(1) as
spelled. Measured before the ports — the classical rule sets bridged into the
EBNF form, every rule's closure run through `parserRuleSet`, each conflict
masked once found so the next surfaced — they refused in eight shapes. The
table is the record of what each port changed and why; the ports' own issues
closed with them.

| grammar | rule | refusal | class |
|---|---|---|---|
| tokenizer | `multilineContent`: `end: ['*', '/']` beside `more: [char, …]` | first/first on `*` | grammar: left-factor the `*` |
| tokenizer | the `operator` variant, 56 literals | first/first on `=`, and on every shared prefix behind it | grammar: a prefix tree, built from the list — `literals` in `fjs/ebnf` |
| tokenizer | the `token` variant: `comment`, `['/', { oneline, multiline }]`, beside `operator`, which holds `/` and `/=` | first/first on `/` | grammar: left-factor the `/`, the shape of the `*` above. Not removed by the prefix tree — checked with the operator's first set kept whole — and masking a rule by replacement erased `/` from that set, which is how a first count missed it |
| tokenizer | `number`: `digits0`, then the `option({ bigint, frac })` | first/follow on the digits, and on `e`, `E`, `n` | the `numError` poison: `[idChar]` follows every optional part of a number, and `idChar` holds digits and letters. The number boundary is decided one layer up, over the token stream |
| tokenizer | `jsGrammar = repeat0Plus(token)`: the `idChar` repeat of `id`, the body of a `//` comment, its `option(newLine)`, the number's `{ numError: [idChar], ok: none }` itself, its `fracPart` on `.`, the exponent's sign option on `+` and `-`, and `multilineContent` | first/follow on the next token's first set | inherent to a whole-file grammar: a greedy token against the token after it. With the entry a single `token` the seven vanish — verified on the bridged set and on a two-rule grammar. The poison is the row above seen from outside the number: nullable, so its follow set is the next token's |
| parser | `statementEnd`: `[trivia, ';', …]` beside `[lineTrivia, 'nl', …]` | first/first on the trivia symbols | trivia leads both branches. Trivia follows every token instead, and `;` ends every statement — the newline terminator is gone, the design [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)'s stage 5 decided |
| parser | `delimited`: `repeat0Plus([',', trivia, element, trivia])` then `option([',', trivia])`, once for arrays and once for objects | first/follow on `,` | the trailing comma, which rested on a failed round rewinding; spelled right-recursively, `item t [ ',' t [ items ] ]` |
| parser | the module's final `{ semicolon: [trivia, ';'], none: [] }`, then `trivia` | first/follow on the trivia symbols | trivia leads the option and follows it; gone with the `;` after every statement |

So each port was a grammar rewrite plus a backend swap, not a swap alone,
and the tokenizer also needed a token layer — a parser resumable at an
index, the loop over it being the tokenizer's — since a whole-file token
grammar is not LL(1) under a first/follow check. Maximal munch inside a token
comes for free, an optional round starting whenever the lookahead is in the
item's first set, once the punctuators are a prefix tree built from the
list. An earlier count through the classical `dispatchMap`, which had no
first/follow check, found three of the eight.

## Next steps

- [x] use JS tokenizer
- [x] identifiers `{a:5}`
- [x] computed keys `{["a"]:5}`, the only spelling of a `__proto__` key
  ([spec: the `__proto__` key](../../spec/README.md#the-__proto__-key))
- [x] big int
- [x] `export default ...`
- [x] constants
  ```js
  const a = [3]
  export default = { a: a, b: a }
  ```
  Serialization
  ```js
  const _0=[3];
  export default {a:_0,b:_0};
  ```
- [x] import
  ```js
  import a from 'c.f.js'
  export default { a: a, b: a}
  ```
- [ ] short form
  ```js
  const a = 5;
  export default { a }
  ```

Optional, for fun, syntax sugar:

- [x] comments. Ignore them. Not an error.
- [ ] double/single quote strings

## Decidable Language

- [ ] using operator and functions
  ```js
  const a = 2+2+Math.abs(5)
  export default { a: a }
  ```
- [ ] decidable functions?
  ```js
  const f = a => b => a + b
  export default f(1)(2)
  ```

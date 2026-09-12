# JSON

Two codecs over one grammar and one reader:

| Codec                              | Numeric leaves     | Entry point                                       |
| ---------------------------------- | ------------------ | ------------------------------------------------- |
| standard (`json.parse`/`stringify`) | `number`           | [`module.f.mjs`](./module.f.mjs)                   |
| extended                            | `number \| bigint` | [`extended/module.f.mjs`](./extended/module.f.mjs) |

```text
JSON text
   |
   v
grammar                   fjs/ebnf/lib/json, read over UTF-16 code units
   |
   v
parse(policy)             one rewrite set folded into the parse, one numeric policy per codec
   |
   +--> number            -> json.Unknown
   +--> number | bigint   -> extended.Unknown
   +--> another policy    -> that codec's own domain
```

The reader is [`parser/module.f.mjs`](./parser/module.f.mjs): a mapping per
rule of the grammar, folded by [`fjs/ebnf/ll1`](../../ebnf/ll1/README.md) as
it parses, so that the value is built where each node is and nesting depth
stays on the machine's own stack. A parse that fails reports where; a number
the policy refuses is the policy's error in the number's place, and a
container holding one is that error too. The reader is built from the
grammar's exported rules, so what it accepts is what
[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) spells, not what a
JavaScript lexer happens to.

A string is folded rule by rule — an `escape` to the character it spells, a
`character` to its text, the `string` to the text of its characters — each
keyed by a rule the grammar exports, and the three mappings are exported as
one unit for a grammar built over JSON's rules:
[`fjs/media/datajs`](../datajs/README.md) reads a DataJS string with them,
its containers through the grammar's own `items`, and its numbers through
JSON's integer core.

There is no JSON tokenizer any more. The one this package carried was an
adapter over the hand-written JavaScript scanner, off `parse`'s path since
the reader became the grammar and with no consumer but its own proofs; it
was retired with that scanner (stage 7 of
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md))
rather than rebuilt, since a token stream nothing reads is not an API worth
keeping. JSON's lexical facts are pinned where they are decided, in
[`fjs/ebnf/lib/json`](../../ebnf/lib/json/module.f.mjs) and the parser's
proofs.

## Losslessness starts at the grammar

The `number` rule's mapping hands the codec's policy the lexeme and nothing
derived from it, so a syntactically valid literal always reaches the policy
whole: a coefficient with more digits than `number` can hold, an exponent
past `number`'s precision, or both. Nothing narrows until the policy asks for
a runtime value.

What the lexeme-first design replaced was worse than redundant. The tokenizer used to accumulate a
`BigFloat` alongside the lexeme — the coefficient with bigint arithmetic per
digit, quadratic in the digit count, and the exponent as an ordinary `number`.
Past 2^53 that exponent silently lost digits: `1e999999999999999999999`
tokenized with an exponent of `1.0000000000000001e21`, and
`1e99999999999999999999` with `100000000000000020000`. No consumer ever read
the field, so this was a latent corruption rather than an observed bug — but a
derived value that has to be right before the token exists is the wrong shape
regardless of who reads it.

## The numeric policy is the seam, not an exact tree

Each codec supplies a `NumberPolicy`: given the lexeme, produce a leaf of that
codec's own domain, or fail. The reader hands every number's lexeme to it and
knows nothing else about numbers, so:

- standard parsing never has to build an intermediate `bigint`;
- extended parsing never has to go through a rounded `number`;
- a policy can reject a number its domain cannot represent, as an ordinary
  `Result` error rather than an escaping exception — the first in document
  order, where a document holds several, is the parse's.

The design this replaces was an intermediate tree with `NumberToken` values at
its numeric leaves, materialized afterwards per codec. That representation is
not sound in a JSON-shaped tree: `{"kind":"number","value":"5"}` is a perfectly
ordinary JSON object, and a materializer walking such a tree cannot tell it
from a retained token. Making it sound requires tagging every node — a second
tree built and walked for no gain, since materialization runs immediately after
the parse anyway. Parameterizing the one parser keeps the exact lexeme
available to every policy, with no representation that can be confused with
data.

Exact questions that a policy must answer *before* narrowing — "is this token
an integer?", which `1.00000000000000001` and `1` answer differently while
being one `number` — belong to [`number/module.f.mjs`](./number/module.f.mjs).
Its helpers read the lexeme in the length of the token: no coefficient bigint,
no exponent conversion, and no `10 ** exponent`, so an input like
`1e-99999999999999999999` is classified from a sign and a length.

## Numeric policies

Standard: every number becomes a `number`, the way JavaScript itself reads that
text — `1e400` is `Infinity`, `1e-400` is `0`. The bigint-free domain has
nothing more exact to offer.

Extended: bare integer syntax becomes a `bigint`, exactly, whatever its
magnitude; `.`/`e`/`E` syntax becomes a `number`; the exact lexeme `-0` stays a
`number`, since `bigint` has no negative zero. A number outside the finite
`number` range is a parse error rather than `Infinity` — the extended domain
is exact where it claims to be, so it rejects instead of rounding. Ordinary
rounding *within* the range (`1e-400` to `0`, `0.1` to the nearest double) is
inherent to `number` and is not an error.

Serialization keeps the two runtime types apart, so an extended round trip is
one-to-one: `0n` is `0`, `0` is `0.0`, `-0` is `-0`. A `bigint` is always its
full base-10 digits, never exponent notation — that syntax would parse back as
a `number`. `NaN` and the infinities have no JSON syntax at all; supplied
programmatically, they serialize as `null`.

The output is ordinary JSON text. Another consumer — `JSON.parse`, a service,
another language — is free to read `12345678901234567890` back as whatever
numeric type it has; what the extended codec guarantees is that *it* reads back
what it wrote.

### One documented limit

A valid bare integer beyond the runtime's own bigint limit (V8 rejects above
2^30 bits, some 3.2e8 decimal digits — a JSON document of several hundred
megabytes) throws where the parser calls `BigInt`. FunctionalScript has no
`try`/`catch`, so this cannot be turned into a `Result`, and predicting it from
a digit count would be exactly the size-estimating preflight the codebase
avoids. Treat it as a runtime limit, like stack depth. Nothing before that
point narrows, so the standard parser reads such a document at full size.

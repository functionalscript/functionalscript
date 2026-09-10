# DJS Parser

Reads a DJS token stream as a FunctionalScript module: `import` statements, then
`const` statements, then one `export default`, each ended by `;`.

It is the upper layer of a layered parser: the tokenizer turns code points into
tokens, and this turns tokens into an `AstModule`. Both layers are an LL(1)
grammar read by [`fjs/ebnf/ll1`](../../ebnf/ll1/README.md) and a fold over what
the grammar matched; only the alphabet differs — code points there, token
symbols here.

## The grammar is written down

[`./grammar`](./grammar/module.f.mjs) holds it:

```
module ::= t import* const* export eof
import ::= 'import' t id t 'from' t string t ';' t
const  ::= 'const' t id t '=' t value t ';' t
export ::= 'export' t 'default' t value t ';' t
value  ::= primitive | id | array | object
array  ::= '[' t [ items(value) ] ']'
object ::= '{' t [ items(member) ] '}'
member ::= key t ':' t value
key    ::= id | string | '[' t string t ']'
items  ::= item t [ ',' t [ items ] ]
t      ::= (ws | nl | comment)*
```

It is LL(1): one symbol of lookahead decides every choice, and the backend
refuses a grammar where it would not, before any input. Three things are spelled
for that, each a conflict the backtracking grammar this replaced had
([ebnf-migration](../../todo/ebnf-migration.md), the consumer port):

- **Trivia follows a token, never leads a rule.** Every token is followed by
  `t`, so no rule begins with trivia and no two branches begin with it.
- **`;` ends every statement, the export included.** A newline does not: it is
  trivia, read past, so a missing `;` is found at what came instead — the next
  statement's keyword, or the end of input. This is the rule
  [`todo/parser-serializer-restructure.md`](../../../todo/parser-serializer-restructure.md)
  settles on for FunctionalScript (stage 5) and what DataJS requires; telling a
  newline from a `;` reached through newlines took unbounded lookahead.
- **A list is right-recursive.** After an item and its comma, the lookahead says
  whether an item or the closing bracket follows, so a trailing comma is a comma
  nothing follows.

Two rules that were once code are shape. Statement ordering — every `import`
before every `const` — is `import* const* export`, and a late `import` is a
token the grammar cannot use. `import`, `const` and `export` in the wrong order
report `unexpected token` at the offending keyword.

## The grammar sees symbols; the fold sees text

This is the line that decides where a check belongs, and it is sharper than
"syntax versus semantics". A token's text rides along as metadata, invisible to a
grammar whose terminals are symbols. So every check that has to read a *word* is
the fold's:

- an identifier naming no `const` or `import`;
- a `const` or `import` name already bound — they share one map, so a name taken
  by either is taken for both;
- a bare or string `__proto__` key, which JavaScript reads as an instruction to
  replace the prototype. The computed spelling `{ ["__proto__"]: v }` denotes an
  ordinary property and is accepted, so this is not a lexical rule either.

The fold is where a symbol table already exists, because turning an identifier
into `['cref', n]` or `['aref', n]` *is* the lookup. Do not contort the grammar
to approximate these.

A name binds *before* the value that follows it, which is why `const a = a;`
resolves to the constant being defined rather than failing.

## The rewrite set builds nodes; the fold resolves them

The backend folds a rewrite set into the parse: a mapping per rule, applied as
the rule's node comes into existence, with the rules under it already mapped
([`fjs/ebnf/ll1`](../../ebnf/ll1/README.md)). A mapping sees one node and no
environment, so what the mappings build is a module of *nodes* — a primitive
converted from its token, a reference by the identifier token that spells it, a
container of nodes, a record per statement — and the names are resolved after
the grammar has matched the whole module, statement by statement, on the
pattern [`fjs/media/datajs`](../../media/datajs/parser/module.f.mjs) set.

Nothing walks the tree. The machine's own stack is on the heap, so nesting
depth is the input's; a list's mapping puts one item before the list its
tail's mapping already returned, so a list of any length costs one step at
each of its nodes, though the tree is as deep as the list is long; and the
resolution walks a value over an explicit stack of frames. The wide and deep
inputs in the proof — twenty thousand siblings, twenty thousand levels — are
the bar.

A tree this recursive is more than `tsc` unrolls in places. The list rule's
type leaves the rest of the list as `Rule`, since a reader takes the rest from
the list's own mapping, one symbol by then, rather than from the type. Every
mapping is typed from its rule; the one reader the two list mappings share is
typed by the shape of a list node, as a reader of a combinator's scaffolding
is. The nodes the mappings build, and the alphabet they return them in, are
public types in `./types.ts`, as the rewrite set is.

## Framing keywords are terminals of their own

The tokenizer emits `import`, `const`, `export`, `default` and `from` as `id`
tokens carrying the word in `value`. An alphabet keyed on a token's *kind* would
give all five the symbol of any other identifier, and the grammar could not tell
`export default` from two arbitrary names — module framing would be
inexpressible.

They therefore get their own names in the alphabet, which a registered mapping
allows because a symbol comes from a name's position in a list and a name has no
length limit.

**Splitting them off obliges the grammar to provide an identifier rule.** None of
the five is reserved: `const export = 1;`, `export default export;`, and
`{ from: 2, default: 3 }` all parse. So wherever an identifier is accepted —
binding names, references, object keys, import names — the terminal is the
*union* of `id` and the five keyword symbols, and only the framing positions
demand a specific keyword. Giving a word its own symbol narrows where it is
**required**, never where it is **allowed**.

## Why a registered alphabet is enough

Symbols come from [`fjs/ebnf/token_symbol`](../../ebnf/token_symbol/), which
assigns each name the symbol at its index in one list, above the Unicode range.

The alternative — deriving a symbol from the name's own bytes, so no ordered list
exists — needs a much wider symbol domain and the migrations behind it. It buys a
property this parser cannot observe: the encoding is built at construction, used
for one parse, and no symbol is ever serialized, so order-dependence costs
nothing.

Revisit if a token symbol ever has to be written to a file, which is the trigger
`token_symbol`'s own README names.

## An error is a point, or a span when one is known

`ParseError` carries `metadata` — the position a reader is pointed at — and an
optional `end` that extends it into a span. Only a *lexical* error has one: the
tokenizer knows how far an unterminated string or comment runs, and
`splitEof` passes that span through. A *grammar* failure points at a single
token and stays a point, because a token's extent is not recorded — every
token's `metadata` is its start alone.

Recording it for every token is the widening this design leaves undone, and the
argument for it is the parser's own: the grammar matches rules over whole
tokens, so every rule it reduces has a first and a last token and therefore a
natural span. `export default <value>` is a span, not a point. The moment a
formatter wants to underline a rule rather than a character, every token needs
an end, and the change belongs in `JsTokenWithMetadata.metadata` rather than in
more special cases beside `ErrorToken.end`. Nothing wants that yet:
`errorLocation` in [`fjs/djs/module.f.mjs`](../module.f.mjs) renders the span
an error already carries and the point when there is none.

## What changed at the LL(1) port

One difference from the backtracking parser this replaced, deliberate and
pinned by proof: a newline no longer ends a statement. `export default 1`
alone is `unexpected end` at the end of input, and `const a = 1` followed by
`export default a;` on the next line is `unexpected token` at `export`. Every
other expectation of the parser's proof — values, positions, the order errors
are reported in, the syntax failure found before the unresolved name — is met
unchanged, with the `;` added to its inputs.

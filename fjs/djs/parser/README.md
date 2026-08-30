# DJS Parser

Reads a DJS token stream as a FunctionalScript module: `import` statements, then
`const` statements, then one `export default`.

It is the upper layer of a [layered parser](../../bnf/todo/layered-parser.md) —
the tokenizer turns code points into tokens, and this turns tokens into an
`AstModule`. Both layers run the same BNF engine; only the alphabet differs.

## The grammar is written down

```
module ::= t import* const* export t eof
import ::= 'import' t id t 'from' t string   sep
const  ::= 'const'  t id t '=' t value       sep
export ::= 'export' t 'default' t value
value  ::= primitive | id | array | object
key    ::= id | string | '[' t string t ']'
sep    ::= (ws | comment)* nl
```

This replaced a hand-written state machine whose grammar existed nowhere: a
nine-state value alphabet plus module framing, where the only way to learn what
DJS accepted was to read the control flow of `parseValueOp`…`parseObjectCommaOp`.

Two rules that used to be code are now shape. Statement ordering — every `import`
before every `const` — was a `consts.length === 0` check; it is now `import*
const* export`. Trailing commas were a state; a failed repetition round rewinds
rather than failing the match, so the round that finds `]` where an element
belongs simply ends and leaves the comma to the optional tail.

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

A name binds *before* the value that follows it, which is why `const a = a`
resolves to the constant being defined rather than failing.

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
the five is reserved: `const export = 1`, `export default export`, and
`{ from: 2, default: 3 }` all parse. So wherever an identifier is accepted —
binding names, references, object keys, import names — the terminal is the
*union* of `id` and the five keyword symbols, and only the framing positions
demand a specific keyword. Giving a word its own symbol narrows where it is
**required**, never where it is **allowed**.

## Why a registered alphabet is enough

Symbols come from [`fjs/bnf/token_symbol`](../../bnf/token_symbol/), which
assigns each name the symbol at its index in one list, above the Unicode range.

The alternative — deriving a symbol from the name's own bytes, so no ordered list
exists — needs a much wider symbol domain and the migrations behind it. It buys a
property this parser cannot observe: the encoding is built at construction, used
for one parse, and no symbol is ever serialized, so order-dependence costs
nothing. Capacity was never the question either; the space holds over 15 million
names and this alphabet uses 26.

Revisit if a token symbol ever has to be written to a file, which is the trigger
`token_symbol`'s own README names.

## Both traversals are iterative

The fold walks an explicit stack rather than the call stack, in two places: the
value fold, and the search that finds a container's elements.

Deep nesting is the obvious reason. The less obvious one is *width*: a repetition
is only flat in the AST when `toData` recognizes the right-recursive shape and
emits a `Repeat`, and nested inside this grammar's option scaffolding it does
not — so a thousand siblings are a thousand levels of tree, and recursing over
them fails exactly as deep nesting would.

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

## What changed from the parser this replaced

Four differences, each deliberate and pinned by proof.

| | before | now |
| --- | --- | --- |
| a late `import` | `import must come before const` | `unexpected token`, same position |
| an empty token stream | `unexpected end` | `missing end-of-input token` |
| a stream with no `eof`, or two | accepted | rejected |
| an unresolved name *and* a syntax error | the name | the syntax error |

The third tightens what a public function accepts. The tokenizer always emits
exactly one final `eof`, so only a hand-built stream can reach it, but a backend
synthesizes its own logical end — a missing marker leaves nothing to require, and
a second is a symbol the grammar has no rule for.

The fourth is the match/fold boundary: the grammar matches the whole module
before the fold resolves any name, so a malformed suffix is found first. Both
errors are true of the input, and the syntax failure is the furthest relevant
token. Names are still checked — with nothing malformed after it, `export default
missing` reports `const not found` as before.

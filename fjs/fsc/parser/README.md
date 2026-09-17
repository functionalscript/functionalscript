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
import ::= 'import' t id t 'from' t string t [ 'with' t '{' t id t ':' t string t '}' t ] ';' t
const  ::= 'const' t id t '=' t value ';' t
export ::= 'export' t 'default' t value ';' t
value  ::= ladder(primary     ::= (primitive t | id t | array | object) access*) | func
body   ::= ladder(bodyPrimary ::= (primitive t | id t | array) access*) | func | block
block  ::= '{' t 'return' s value ';' t '}' t
func   ::= '(' t '...' t id t ')' s '=>' t body
access ::= '.' t id t | '[' t (string | number) t ']' t
array  ::= '[' t [ items(value) ] ']' t
object ::= '{' t [ items(member) ] '}' t
member ::= key t ':' t value
key    ::= id | string | '[' t string t ']'
items  ::= item [ ',' t [ items ] ]
t      ::= (ws | nl | comment)*
s      ::= (ws | comment)*
```

It is LL(1): one symbol of lookahead decides every choice, and the backend
refuses a grammar where it would not, before any input. Three things are spelled
for that, each a conflict the backtracking grammar this replaced had
([the record](../README.md#both-grammars-are-ll1) of all eight):

- **Trivia follows a token, never leads a rule.** Every token is followed by
  `t`, so no rule begins with trivia and no two branches begin with it. A
  value ends with its own `t`, and what follows a value adds none: any
  value may be followed by an access, `a . b` and `[1] [0]` included, and
  the trivia between them would otherwise have to lead the access rule.
- **`;` ends every statement, the export included.** A newline does not: it is
  trivia, read past, so a missing `;` is found at what came instead — the next
  statement's keyword, or the end of input. This is the rule
  [`spec/README.md`](../../../spec/README.md) states for FunctionalScript and
  what DataJS requires; telling a newline from a `;` reached through newlines
  took unbounded lookahead.
- **A list is right-recursive.** After an item and its comma, the lookahead says
  whether an item or the closing bracket follows, so a trailing comma is a comma
  nothing follows.

Two rules that were once code are shape. Statement ordering — every `import`
before every `const` — is `import* const* export`, and a late `import` is a
token the grammar cannot use. A reserved literal — `true`, `false`, `null`,
`undefined`, `NaN`, `Infinity` — has its own symbol, never `id`'s, so it is
refused as a name, a reference or a key by the rule that wanted an
identifier, and read as the value it names where a value may stand.
`-Infinity` is one token, the tokenizer folding the `-` into the word as it
folds one into a number and a bigint. `import`, `const` and `export` in the wrong order
report `unexpected token` at the offending keyword.

## The operator ladder

Stage A of [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md)
(landed: [`spec/README.md`'s Operators section](../../../spec/README.md#operators))
— arithmetic, strict comparison, bitwise — sits inside `value`/`body` in
place of the bare primary those two productions used to spell directly:
`ladder`, in `./grammar/module.f.mjs`, is a nine-layer precedence chain built
once per primary (`value`'s, with an object; `body`'s, without) and documented
in full where it is built — the precedence and associativity table, why
`unary` sits above `exponent` rather than below it as JavaScript's own
grammar has it, and the LL(1) argument for each layer. A function is never a
ladder operand: nothing bounds a lambda's body against an operator to its
right without grouping ([`../todo/grouping.md`](../todo/grouping.md)),
so `value`/`body` keep `func` a sibling of the whole ladder, exactly where it
already stood beside the old bare primary.

Landing this reopened the one negation question the grammar had settled
differently before: unary `-` is real syntax now, `-` no longer folding into
anything but an *immediately adjacent* number, bigint, or `Infinity` token —
`-1` and `-Infinity` are still one token each, and `- 1`, with a space, is the
Stage A operator applied to `1`. `fjs/fsc/tokenizer/module.f.mjs`'s
`_DjsScanState` decides this at the token boundary, before the grammar ever
sees a `-`, so the fold above never has to.

## The grammar sees symbols; the fold sees text

This is the line that decides where a check belongs, and it is sharper than
"syntax versus semantics". A token's text rides along as metadata, invisible to a
grammar whose terminals are symbols. So every check that has to read a *word* is
the fold's:

- an identifier naming no `const` or `import`;
- a `const` or `import` name already bound — they share one map, so a name taken
  by either is taken for both;
- a JavaScript keyword where JavaScript wants an identifier — a name bound or
  referenced. The tokenizer hands every keyword over as an `id` token, since
  a key or the name after `.` may be one, so `const if = 1;` and
  `export default class;` are the fold's to refuse and `{ if: 1 }` is a
  member: a broken JavaScript program is a broken FunctionalScript program;
- an import attribute other than `type: "json"`, the one JavaScript defines,
  read from the key's and the value's words;
- an access on a number or a bigint literal, `1 .x` or `-1n[0]`: JavaScript
  reads `-1 .x` as `-(1 .x)`, the tokenizer folds the minus into the number
  and `-0n` to `0n`, and the language has no negation to read it JavaScript's
  way, so every access on a numeric literal is refused rather than some;
- a reference in a function's body to a name bound outside it — a `const`, an
  import, or an enclosing function's parameter — which is a capture, and a
  function has no frame to capture with yet. The body is resolved against its
  parameter alone, so the check is which map the name is found in;
- a bare or string `__proto__` key, which JavaScript reads as an instruction to
  replace the prototype. The computed spelling `{ ["__proto__"]: v }` denotes an
  ordinary property and is accepted, so this is not a lexical rule either;
- an access naming a property of a built-in prototype, `a.push`,
  `a["toString"]` or `a.__proto__` in either spelling — every name
  [`fjs/js/prototype`](../../js/prototype/module.f.mjs) lists but `length`,
  which a value owns — since an access reads an own property and JavaScript
  would read the prototype's, as
  [spec: property accessor](../../../spec/todo/2330-property-accessor.md)
  prohibits. The key of an access is a constant — an identifier after `.`, a
  string or a number in `[ ]` — so what remains is the EDAG's own form,
  `['.', base, key]`, and the grammar refuses a runtime key at the token.

The fold is where a symbol table already exists, because turning an identifier
into `['cref', n]` or `['aref', n]` *is* the lookup. Do not contort the grammar
to approximate these.

A `const`'s value is resolved *before* its own name is bound, so `const a = a;`
is `const not found` — a reference to a name before its declaration, as it is
in JavaScript, and as the DataJS reject corpus's `reference-self` requires.
A name binds before the values that *follow* it, so a later statement may name
an earlier `const`, which is what a `cref` always is: a reference to an earlier
entry.

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

## Required keywords are terminals of their own

The tokenizer emits `import`, `const`, `export`, `default`, `from`, `with` and
`return` as `id` tokens carrying the word in `value`. An alphabet keyed on a
token's *kind* would give all seven the symbol of any other identifier, and the
grammar could not tell `export default` from two arbitrary names — module
framing would be inexpressible, and so would a block body's `return`.

They therefore get their own names in the alphabet, which a registered mapping
allows because a symbol comes from a name's position in a list and a name has no
length limit.

**Splitting them off obliges the grammar to provide an identifier rule.**
Wherever an identifier is accepted — binding names, references, object keys,
import names, the name after `.` — the terminal is the *union* of `id` and the
seven keyword symbols, and only the positions that frame something demand a
specific keyword. Which of them a position may hold is the fold's question, as
it is for every other keyword, since it is a property of the word: JavaScript
reserves six of the seven and `from` alone is ordinary, so
`{ from: 2, return: 3 }` and `a.with` parse and `const export = 1;` is refused,
exactly as `const if = 1;` is. Giving a word its own symbol narrows where it is
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
`errorLocation` in [`fjs/fsc/module.f.mjs`](../module.f.mjs) renders the span
an error already carries and the point when there is none.

## What changed at the LL(1) port

One difference from the backtracking parser this replaced, deliberate and
pinned by proof: a newline no longer ends a statement. `export default 1`
alone is `unexpected end` at the end of input, and `const a = 1` followed by
`export default a;` on the next line is `unexpected token` at `export`. Every
other expectation of the parser's proof — values, positions, the order errors
are reported in, the syntax failure found before the unresolved name — is met
unchanged, with the `;` added to its inputs.

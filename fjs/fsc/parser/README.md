# DJS Parser

Reads a DJS token stream as a FunctionalScript module: `import` statements, then
ordinary and exported `const` statements, with an optional final `export default`.
Every statement ends with `;`, and at least one export is required.

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
export ::= 'export' t ( 'default' t value ';' t | const const* [ export ] )
value  ::= '-' t unaryOperand tail | '~' t unaryOperand tail
         | id s afterName
         | (primitive t | array | object) access* powTail tail
         | '(' t parenthesized
body   ::= '-' t unaryOperand tail | '~' t unaryOperand tail
         | id s afterName
         | (primitive t | array) access* powTail tail
         | '(' t parenthesized | block
afterName ::= '=>' t body | n access* powTail tail
parenthesized ::= '...' t id t ')' s '=>' t body
         | ')' s '=>' t body
         | id s ( '=>' t body ')' t access* powTail tail
                | n ( ',' t [ names ] ')' s '=>' t body
                    | access* powTail tail ')' s afterName ) )
         | groupValue ')' t access* powTail tail
groupValue ::= value less its `id s afterName` branch
names  ::= id t [ ',' t [ names ] ]
unary  ::= '-' t unaryOperand | '~' t unaryOperand
         | (primitive t | id t | array | object) access* powTail
         | '(' t group
unaryOperand ::= '-' t unaryOperand | '~' t unaryOperand
         | (primitive t | id t | array | object) access*
         | '(' t groupOperand
block  ::= '{' t const* 'return' s value ';' t '}' t
group  ::= value ')' t access* powTail
groupOperand ::= value ')' t access*
powTail ::= [ '**' t unary ]
eagerTail ::= { mulOp t unary }
           { addOp t unary <the multiplicative repeat above> }
           …six more layers, each repeating over every layer below it the
           same way — shift, relational, equality, bitwiseAnd, bitwiseXor,
           bitwiseOr, JavaScript's own order
logicalAndRound ::= '&&' t unary eagerTail
logicalOrRound  ::= '||' t unary eagerTail { logicalAndRound }
nullishRound    ::= '??' t unary eagerTail
circuitTail ::= [ logicalAndRound { logicalAndRound } { logicalOrRound }
                | logicalOrRound { logicalOrRound }
                | nullishRound { nullishRound } ]
conditionalTail ::= [ '?' t value ':' t value ]
tail   ::= eagerTail circuitTail conditionalTail
access ::= '.' t id t | '[' t (string | number) t ']' t | '(' t [ items(value) ] ')' t
array  ::= '[' t [ items(value) ] ']' t
object ::= '{' t [ items(member) ] '}' t
member ::= key t ':' t value
key    ::= id | string | '[' t string t ']'
items  ::= item [ ',' t [ items ] ]
t      ::= (ws | nl | comment)*
s      ::= (ws | comment)*
n      ::= [ nl t ]
```

It is LL(1): one symbol of lookahead decides every choice, and the backend
refuses a grammar where it would not, before any input.

A `(` opens a function or a group, so `paren` takes the `(` and
`parenthesized` parts at the symbol after it: `...` and `)` are a
function's, and a name is read before the two are told apart, since
`(a) => 1` is a function and `(a).b` a group. JavaScript itself tells those
apart only past the `)`, and so does this grammar without looking past it:
the name is read with the rest of a value after it and the `)`, and `=>`
on the same line as the `)` decides, one symbol. That reading admits
`(a.b) => 1` — JavaScript's cover grammar, at one name's width — which the
fold refuses as `invalid parameter list` at the arrow, and no more:
`((a)) => 1` and `(1) => 1` open with no name and fail at the `=>`, as any
value followed by one does. A bare name is read the same way, `a => 1` and
`a.b` parting at the symbol after the name, and a newline there is where a
value goes on and no arrow may follow, JavaScript's own
`[no LineTerminator here]`.

A `-` or a `~` takes the group under its `(` and not `paren`, the two
differing by the function: `-(...a) => 1` is a syntax error in JavaScript
and `-((...a) => 1)` is not, so the operand is the group alone and the
`...` is refused where JavaScript refuses it rather than at the `(`. Every
binary operator's operand is `unary` — see the next section for why it
can be no wider a rule — but `-`/`~`'s own operand is `unaryOperand`, a
narrower rule still: JavaScript refuses `**` immediately after a
unary-prefixed operand, full stop, at any depth (`- -2 ** 2` exactly as
`- 2 ** 2`), so `unaryOperand` is every alternative `unary` has minus
`powTail`, recursing through itself rather than `unary` for a nested
`-`/`~`. Only `(-2) ** 2` and `-(2 ** 2)` write either reading:
parentheses that move the `**` to where it no longer immediately follows
the prefix.

`tail`, the operator suffix — Stage A's eager ladder and Stage B's lazy
operators and conditional above it
([`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md)) — is
threaded onto every branch of `value`/`body` that may carry one, inline,
rather than wrapping a shared primary the way a textbook precedence ladder
would. That wrapping was tried first and rejected: `func`'s body is
unbounded, reading everything to its right as its own, so a primary the
ladder also wrapped would leak the ladder's own follow set down into the
body and manufacture an LL(1) conflict with no real ambiguity behind it —
a greedy reader never needs the choice the checker flags, but the checker
cannot see that. Spelling `tail` inline, with `unary` — narrow, `func`
excluded — as every operand throughout, avoids the leak entirely: `func`
is reachable only where `value`/`body` put it directly, never as a repeated
operand any layer wraps.

The short-circuit level, `circuitTail`, is a choice its first operator
makes rather than one more repeat: JavaScript keeps `??` apart from
`&&`/`||` at one nesting by giving the two their own productions,
`LogicalORExpression` beside `CoalesceExpression`, and spelled as that
choice the two alternatives open with one operand, a first/first conflict
the checker refuses before any input. So the operand belongs to the branch
its operator opens, the choice is made at that operator — one symbol — and
a chain committed to `&&`/`||` has no round for `??`, nor a `??` chain for
either: `a ?? b || c` fails at the `||`, refused by the grammar's shape and
by nothing after it. The conditional is the top, `? value : value`, each
arm the whole value rule — JavaScript's arms are `AssignmentExpression`s,
and with no assignment the ladder's own top is the nearest — so a nested
conditional associates to the right through the arms' recursion, and `:`
follows a function's body there without a conflict, nothing a body may
continue with beginning with it: `a ? () => 1 : 2` is the function and the
else arm, as JavaScript reads it. Both are read by the same fold as the
eager layers, a branch's round being a layer's round and its continuation
the repeat lists a value's own tail is, plus one reader for the two arms.

Three more things are spelled for one symbol of lookahead, each a conflict
the backtracking grammar this replaced had
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
before every ordinary or exported `const` — is in the grammar, and a late
`import` is a token it cannot use. The `export` rule factors the common keyword:
`default` ends the module, while `const` can be followed by ordinary declarations
and another export. Its optional tail permits a named-only module. A reserved literal — `true`, `false`, `null`,
`undefined`, `NaN`, `Infinity` — has its own symbol, never `id`'s, and the
rules take it wherever a *name* may stand: `{ NaN: 1 }` and `a.NaN` are a
key and an access, and `const NaN = 1;` reaches the fold and is refused
there, as `const if = 1;` is. Where a *value* may stand it is the value it
names, which is the one position the two rules keep apart.
`-Infinity` is two tokens, the `-` being the unary minus the grammar reads
rather than a sign folded into the word, so `-Infinity` is a negation where a
value may stand and a `-` the grammar answers at where a name may.
`import`, `const` and `export` in the wrong order
report `unexpected token` at the offending keyword.

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
- a body `const` that takes a name the body already binds, its parameter
  included, which is a duplicate as a module's is. A name a scope *around*
  the body binds is not: the body's `const` shadows it, as in JavaScript —
  unless the body has already read that name from outside, before the
  `const` or in its own initializer, which is `capture shadowed`: not a
  rule of the language but a forward reference inside a body, not yet
  supported
  ([`todo/body-const-forward-reference.md`](todo/body-const-forward-reference.md)),
  refused because JavaScript would read the body's `const` there;
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
  `['.', base, key]`, and the grammar refuses a runtime key at the token;
- a method call naming a member function a module may not call, `a.push(1)`
  or `a.valueOf()` — the names `prohibitedCalls` in the same module lists,
  its [README](../../js/prototype/README.md) saying why for each. An access
  that is a call's callee, through a group as well, is checked against that
  list instead of the read rule, so `a.at(0)` and `a.toString()` are calls
  like any other while `a.at` stays a refused read: a detached built-in is a
  function that only fails.

The fold is where a symbol table already exists, because turning an identifier
into `['cref', n]` or `['aref', n]` *is* the lookup. Do not contort the grammar
to approximate these.

A reference in a function's body to a name bound outside it — a `const`, an
import, an enclosing function's parameter or an enclosing body's `const` —
is a **capture**. The body is resolved against its own names first — its
parameter, and the `const`s it declares before the reference — and then
against each scope around it, innermost first; a name found outside becomes
a capture, one per binding in first-use order, which the function node
lists as its third element and the body reads as `['fref', i]`. The frame
is the lowering's: it gives each distinct captured value one slot, so two
bindings of one value share one. A function nested in another captures through it, so the
middle function takes the capture too.

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

Function blocks retain an ordered list of tagged `const` and `return`
statements in this source tree. `() => 7` and `() => { return 7; }` therefore
have different source bodies; the fold lowers them to the same executable
body. The grammar still requires zero or more declarations followed by one
value-returning statement. This representation change adds no syntax or ASI.

`_parseSyntaxFromTokens` exposes that internal tree for proofs before the
fold. It does not establish binding validity, JavaScript early errors or FJS
admission; `parseFromTokens` remains the checked compilation entry point.

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

**Splitting them off obliges the grammar to provide identifier rules.**
Wherever an identifier is accepted the terminal is a *union* of `id` and the
keyword symbols, and only the positions that frame something demand a
specific keyword. There are two such unions, drawn where JavaScript draws
them:

- `identifier`, `id` and the seven framing keywords, for a **reference** —
  where a value may stand, and where a word that denotes a value is that
  value rather than a name;
- `identifierName`, those and the six words that denote a value, for a
  **name** — an object key, the name after `.`, and a binding name, which is
  JavaScript's `IdentifierName` and admits every reserved word.

Which of them a position may hold is the fold's question, as it is for every
other keyword, since it is a property of the word: `{ from: 2, return: 3 }`,
`a.with`, `{ NaN: 1 }` and `a.NaN` parse, while `const export = 1;` and
`const NaN = 1;` are refused where `const if = 1;` is. Giving a word its own
symbol narrows where it is **required**, never where it is **allowed**.

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

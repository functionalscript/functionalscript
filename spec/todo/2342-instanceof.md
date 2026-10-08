# `instanceof Array`

**Priority:** P2
**Status:** open — awaiting a language designer's approval before implementation

## Problem

FunctionalScript detects an array with `a instanceof Array`
([`fjs/AGENTS.md`](../../fjs/AGENTS.md), "Detect an array with
`a instanceof Array`"), and the compiler refuses the operator. The spelling
the repository mandates is one the language cannot compile, so every module
that tells an array from an object is migration debt the day it is written,
and the one at the root of the tree — `fjs/types/object/structurally_same`,
which nearly every module imports — waits on it
([`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md),
"What the next rename waits on"). A handful of modules meet it as their
first refusal; many more meet it behind a template literal or a
destructuring they would meet first.

The test exists below the front end in everything but name: an evaluated
array is tagged, `['[]', values]`
([`fjs/edag/value`](../../fjs/edag/value/module.f.mjs)), so the predicate
is one tag check beside the one
[`fjs/edag/value/semantics`](../../fjs/edag/value/semantics/module.f.mjs)'s
`typeOf` makes for the function tag, and `nanvm-lib` dispatches on an
`Unpacked::Array` variant. What is missing is the EDAG operation and the
syntax.

## Proposal

**Admit `x instanceof Array`, and only that.** The right operand is the
word `Array`; any other right operand is refused. This is the
`instanceof` the repository's FunctionalScript is written with
([`fjs/AGENTS.md`](../../fjs/AGENTS.md)), and the one with no other
spelling. It is not the only one a FunctionalScript module writes:
`toIoError` in [`fjs/effects`](../../fjs/effects/module.f.mjs) tests
`e instanceof Error` (below). An object is an instance of `Object` and a function of
`Function`, and the language builds both, but `instanceof Object` and
`instanceof Function` make no sense here: `typeof x === "object"` and
`typeof x === "function"` are the spellings for those. `f instanceof
Function` is `typeof f === "function"` exactly. `o instanceof Object` is
not any one `typeof` test — it is `true` of a non-null object, an array
and a function alike, and `false` of `null`, so it does tell `null` from
`{}` — but the set it names, three kinds less one value, is one no
FunctionalScript code asks for: a reader asks whether a value is an
object, an array, a function or `null`, and `typeof`, this operator and
`=== null` answer each with one spelling. Neither is admitted, now or
later. An array has no tag of its own but this. The language has no classes ([`3390-class.md`](./3390-class.md)),
admits no global as a value ([`2360-built-in.md`](./2360-built-in.md))
and builds no `Map`, `Set`, `Promise` or `Error`, so nothing else is a
candidate yet; the list below is for the types the language may add,
such as `Set` or `RegExp`.

`instanceof Error` is not admitted either, though `fjs/effects` writes
it. The language builds no `Error` — there is no `new` — so over every
value it builds the test answers `false`, and an `Error` reaches a module
only as a value the host threw, at a runner's `catch`. That is the rule
`Map` and `Set` wait under: a form admitted the day the language can build
a value it is true of, not before. `toIoError` therefore keeps meeting the
refusal, and its way past is the module's, not the operator's: read the
fields, as [`fjs/emergent_testing/browser`](../../fjs/emergent_testing/browser/module.f.mjs)
already does for a cross-realm `Error`, which `instanceof Error` misses
([`to-io-error-instanceof.md`](../../fjs/effects/todo/to-io-error-instanceof.md)).

### Syntax

```js
export default (a, b) => a instanceof Array && b instanceof Array;
```

- **Precedence.** JavaScript's own: `instanceof` is a relational operator,
  one level with `< <= > >=`, left-associative. `a instanceof Array === b`
  is `(a instanceof Array) === b`, `a < b instanceof Array` is
  `(a < b) instanceof Array`, `a instanceof Array instanceof Array` is
  legal and `false`. The prefixes bind tighter, so `!a instanceof Array` is
  `(!a) instanceof Array` — JavaScript's famous trap, preserved rather than
  repaired ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions));
  the writer spells `!(a instanceof Array)` with the parentheses.
- **The right operand is read as an expression and must be a reference
  to `Array`.** In the grammar `instanceof` is one more relational
  operator, so its right operand is read as `<`'s is, and the fold admits
  exactly one value there: a reference to the word `Array`. Parentheses
  are a group and vanish in the AST, so `a instanceof (Array)` is the same
  node as `a instanceof Array`, as in JavaScript;
  `a instanceof Array.prototype.constructor` is an access, not a
  reference, and is refused with a message naming the rule, as is any
  other value. The restriction is to what the language has a meaning for,
  not to a spelling.
- **`instanceof` is a reserved word**, as `typeof` is: it names no `const`
  and no parameter, while `{ instanceof: 1 }` and `a.instanceof` are a key
  and a property name as in JavaScript. The tokenizer already hands it over
  as an `id` ([`fjs/js/keywords`](../../fjs/js/keywords/module.f.mjs)); the
  grammar gives it a symbol of its own, as it gave `typeof` one, by adding
  it to `_framingKeywords`. That alone would break the key and the property
  name. The rule a key and a property share is `identifierName`, which
  spreads the grammar's `identifier` rule, and `identifier` is enumerated
  by hand, one symbol per framing keyword, not derived from the list. So
  the new symbol is added to `identifier`, as `if`'s is, and reaches a key
  and a property through that spread; `{ instanceof: 1 }` and
  `a.instanceof` are pinned. `typeof` is the one framing keyword kept out
  of `identifier`, because it is required where a value begins and a
  second branch on one symbol there is one `fjs/ebnf/ll1` refuses.
  `instanceof` never stands where a value begins — it opens a tail, after
  an operand, where no reference may stand — so it opens no such branch,
  and reaches the fold through `identifier`, which refuses it as a
  `reserved word` as it refuses `const if = 1;`.
- **`Array` is a reserved word**, like `NaN` and `Infinity`
  ([numbers](../README.md#numbers)): a module cannot bind it as a `const`
  or a parameter, and it still names a property, `{ Array: 1 }` and
  `a.Array`. This is the first entry of
  [`2365-global-names.md`](./2365-global-names.md)'s list to land, for
  the reason that file gives: a module that binds the word means
  something else by it. Checking the scope at the operator is not enough,
  because the fold resolves a reference against the names bound so far
  ([`3140-forward-references.md`](./3140-forward-references.md)), so in
  `const x = [] instanceof Array; const Array = 1;` the operator would
  see `Array` unbound and answer `true`, where JavaScript throws on a
  binding still in its temporal dead zone — a plausible wrong value, which
  the language never gives. Refusing the binding anywhere in the module
  closes both orders at once, and the refusal already exists: the fold's
  `reserved word`, one name longer. It is a breaking change — `const
  Array = 1;` compiles today — declared by the pull request that lands
  it; no FunctionalScript source in the repository binds the word, so it
  costs no rename.

### Semantics

`x instanceof Array` is `true` when `x` is an array and `false` otherwise:
`null`, `undefined`, every primitive, an object and a function included. It
never throws — `Array` is a callable constructor — and it converts nothing.
Over FunctionalScript's values it is exactly `Array.isArray(x)`: the two
predicates differ only on a value whose prototype chain was re-pointed or
that belongs to another realm, and no FunctionalScript value is either
([`fjs/AGENTS.md`](../../fjs/AGENTS.md)).

### The EDAG

A new node, `['instanceof', exp, constructor]`, where `constructor` is a
name from a closed list — `'Array'` today — not an expression
([`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs)). The node reads
as the source does, and the list is where it grows: `instanceof Map` and
`instanceof Set` are one name each, once the language can build a `Map`
or a `Set` for the test to be true of. Until then neither is admitted,
since a form that can only answer `false` is not worth a reader's arm.

A name in an operand position has precedent: `['arg', N]` and
`['frame', N]` carry a number that is no expression, and the index of
`['.', exp, index]` is a constant string or number where it is not a
node. What is new is a *word* that is neither a value nor a node, so the
schema says so — a variant over the admitted names, as `op1Id` is a
variant over tags — and no consumer evaluates it. The cost is one arm per
consumer: the schema, the memo analysis, both interpreters, the Rust
printer and the writer each dispatch on the tag and read the name, and
the two generic operand walkers each gain a case so that the name is not
walked as a string literal (the drawback below).

#### Why the node carries a name, not a unary tag

This is a decision of the language designer, made with the alternative
in view, and it is final for this proposal: a review that asks for the
unary shape again is answered by this section.

The alternative is one unary tag per constructor — `isArray` today,
`isSet` or `isRegExp` after it. It is cheaper for `Array` alone: a unary
node is a shape every walker already handles, so the two operand walkers
need no case and the type checker needs no new variant. It is rejected
for four reasons:

1. **More types may follow, like `Set` or `RegExp`.** None is approved
   yet: `Map` is one of the options
   [`object-identity.md`](./object-identity.md) weighs for custom
   dictionaries, and regular expressions are an open item on the
   [roadmap](./README.md). But if we plan to add more types like these, a
   value of each must be told from one that is not, exactly as an array is
   from an object today. The shape is chosen so that the second
   constructor and every one after it is a name added to one list, and
   not a new tag at every consumer: the schema,
   the memo analysis, both interpreters, the Rust printer, the writer and
   the corpus each dispatch on the tag, and a unary tag per constructor
   means a new arm in each of them per constructor. Under this shape the
   name is read where the tag is dispatched, once.
2. **JavaScript has no `isMap`, `isSet` or `isRegExp`.** `Array.isArray`
   exists because `instanceof Array` fails across realms, and it was added
   in ES5 for that one case; `Map` and `Set` arrived in ES2015 with no
   such function, `RegExp` has never had one, and `x instanceof Set` is
   their one spelling in the language (Node's `util.types.isSet` is a
   host API). A unary `isSet` tag would be a predicate the source language
   cannot write, named after a function that does not exist. `instanceof` with the constructor beside it is
   the EDAG reading as the JavaScript does.
3. **The cost is paid once and it is pinned.** The arms and the two
   walker cases are the price of the shape, and the implementation that
   lands the operator pays it with a proof per consumer that the name is
   read and never walked, so a consumer that loses its case fails its
   proof rather than evaluating `'Array'`. Taking the unary tag first
   would mean a second implementation of the same operator, to be
   replaced with this one the day the second constructor lands — a
   smaller first step that is paid for twice.
4. **Changing the shape later is a breaking change; choosing it now is
   not.** The EDAG is the language's data format
   ([serialization](./serialization.md)): every compiled module, every
   corpus case and every consumer outside this repository holds the node
   as it is spelled. A unary `isArray` landed today becomes, if a `Set`
   arrives, either a second shape beside the first — `isArray` unary,
   `instanceof` with a name, two spellings of one operator forever — or a
   replacement of every `isArray` node ever emitted, which is the
   breaking change the first option exists to avoid. Today no
   `instanceof` node exists anywhere, so the shape costs nothing to
   choose and the choice is the one time it is free.

The right operand is a name rather than a value because the EDAG has no
constructor values: no global is a value in it
([`2360-built-in.md`](./2360-built-in.md)), and neither interpreter nor
`nanvm-lib` holds an `Array` object. Should classes
([`3390-class.md`](./3390-class.md)) one day make the right side a value
of the program's own, how that form is spelled beside this one is that
proposal's question; the name form stays for the built-ins either way.

### Benefits

- The repository's own array test compiles, which every module telling an
  array from an object needs and `structurally_same` needs first.
- No new conversion and no failure path: the smallest operator the
  language can add, and the one node grows to any later type, such as
  `Set` or `RegExp`, by a name each, with no new tag anywhere.
- `nanvm-lib`'s `instanceof` row stops reading as unimplemented for the one
  case the compiler will ever emit.

### Drawbacks

- The language admits a narrower `instanceof` than it looks like: a
  reader who writes `x instanceof Map` meets a refusal that names the
  rule, not a parse error. That is the price of admitting the useful case
  before the general one, and the refusal says what is missing.
- The `!a instanceof Array` trap is preserved.
- A node shape the EDAG did not have — an operand that is a name — so
  every consumer that walks operands generically learns one node that it
  may not evaluate. The two generic walkers, `operandsOf` in
  [`fjs/edag/analysis`](../../fjs/edag/analysis/module.f.mjs) and in
  [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs), take everything
  after the tag as an operand unless the tag says otherwise, and a string
  is a valid expression, so a forgotten case would walk `'Array'` as a
  string literal and no type checker would object. Each needs an
  `instanceof` case, as each has an `arg` case, and a proof that pins it.
  This is the real cost of the shape, and the reason the unary alternative
  is cheaper today: it adds no node a walker can get wrong. Why the shape
  is taken regardless is settled under
  [the EDAG](#why-the-node-carries-a-name-not-a-unary-tag).
- One more per-operator arm in each consumer, the count
  [`fjs/compiler/todo/unary-tags.md`](../../fjs/compiler/todo/unary-tags.md)
  tracks; collapsing them stays that task's.

## Tasks

- [ ] A draft pull request claiming this file; the approval, recorded here.
- [ ] `fjs/edag`: the `['instanceof', exp, constructor]` node, the
      constructor-name variant with `'Array'` alone, its row in the README
      table, `semantics`' predicate and `operations`' arm; an `instanceof`
      case in each generic `operandsOf`, `analysis`' and `rust`'s, so the
      name is never walked as an operand, each pinned by a proof; the memo
      proofs.
- [ ] `fjs/compiler/parser/grammar`: `instanceof` in `_framingKeywords`,
      in the hand-enumerated `identifier` rule, so a key and a property
      name keep the word through `identifierName`'s spread, and in
      `relationalTags`; the `types.ts` pins;
      proofs reading `{ instanceof: 1 }.instanceof` and `a instanceof
      (Array)`.
- [ ] `fjs/compiler/parser`: `Array` among the reserved words the fold
      refuses as a binding, with proofs for a `const`, a parameter, a key
      and a property name; the fold's arm for the tag — the left operand
      entered first, as every binary operator's, and the right admitted
      only as a reference to `Array` once the left returns, anything else
      refused with the rule's message — and the AST node. The pull request
      declares the breaking change.
- [ ] `fjs/compiler/ast`: the eager walk's arm for the AST node, one
      operand as the prefixes have, so `anchors` reaches through it.
- [ ] `fjs/compiler/edag`: the lowering's own arm for the AST node, to
      `['instanceof', exp, 'Array']` with the name carried across — the
      AST-to-EDAG step lives here, not in the parser, and without an arm
      its leaf path would read the three-tuple as something it is not; the
      proof compiles a source to the node.
- [ ] `fjs/compiler/serializer`: the main serializer, the compiler's
      JavaScript output — its tag switch, which refuses a tag it does not
      know, prints `(x instanceof Array)`, and its private operand walker,
      which answers nothing for one, yields `x`, so hoisting sees it; both
      with proofs. Its set of export names it refuses, today the keywords
      and the literal words, gains the reserved globals, so that a module
      whose EDAG exports `Array` is refused rather than written as
      `export const Array=1;`, a source the parser no longer reads back;
      a proof pins the refusal.
- [ ] `fjs/compiler/serializer/function_text`: `(x instanceof Array)`.
- [ ] `fjs/compiler/edag/demo`: the website EDAG demo's shape table draws
      the node — one `op` labelled `instanceof Array` with its operand as
      the one child — rather than falling through to "not yet drawn"; the
      proof, and the demo checked in the browser
      ([CONTRIBUTING.md](../../CONTRIBUTING.md#website-demos)).
- [ ] `fjs/edag/rust`: `Any::instanceof_(x, Constructor::Array)`;
      `nanvm-lib`: a `Constructor` enum with the one variant, the method as
      one `Dispatch` over `Unpacked`, the README row; the harness operators
      fixture pins it.
- [ ] `fjs/nanvm`: the corpus format grows a group kind of its own, since
      the existing ones are keyed by the `op1`/`op2`/`op12`/`op3`
      vocabularies and lower every argument to an operand — a group
      carrying the operation and the constructor name, `Case<1>` cases
      (the name is the group's, not an argument; and not a property
      called `constructor`, which every object has through its prototype
      and an `in` test would find on every group); `groupKey` spells it
      `instanceof Array`, `arityOf` answers one, `caseExp` lowers a case
      to `['instanceof', value, 'Array']`, the Rust printer's name table
      and the proof's JavaScript reference each gain the key. Then the
      case set, every value kind against `Array`.
- [ ] `spec/README.md`: the operator — value-type list, precedence list,
      semantics, the keyword's standing as a name; `2340-operators.md`'s
      row **done**; this file deleted.
- [ ] `todo/fjs-nanvm-integration.md`: the two `instanceof` rows point here
      until then.

## Related

- [`2340-operators.md`](./2340-operators.md) — the operator table this adds
  a row to.
- [`2360-built-in.md`](./2360-built-in.md) — why no global is a value the
  right operand could be; `Array.isArray` is listed there, and over
  FunctionalScript's values it is this same test.
- [`2365-global-names.md`](./2365-global-names.md) — reserving `Array`
  is the first entry of its list to land; its tasks tick one name.
- [`3140-forward-references.md`](./3140-forward-references.md) — why a
  scope check at the operator could not see a later binding.
- [`3390-class.md`](./3390-class.md) — where `instanceof` over a class
  value becomes the node's second arity.
- [`fjs/compiler/todo/unary-tags.md`](../../fjs/compiler/todo/unary-tags.md)
  — the per-operator arms this adds one to.

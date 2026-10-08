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
word `Array`; any other right operand is refused. This is the one
`instanceof` the repository uses
([`fjs/AGENTS.md`](../../fjs/AGENTS.md)), and the one with no other
spelling. An object is an instance of `Object` and a function of
`Function`, and the language builds both, but `instanceof Object` and
`instanceof Function` make no sense here: `typeof x === "object"` and
`typeof x === "function"` are the spellings for those, and
`o instanceof Object` is `true` of an array and a function too, so it
separates nothing that `typeof` and this operator do not between them.
Neither is admitted, now or later. An array has no tag of its own but
this. The language has no classes ([`3390-class.md`](./3390-class.md)),
admits no global as a value ([`2360-built-in.md`](./2360-built-in.md))
and builds no `Map`, `Set` or `Promise`, so nothing else is a candidate
yet; `Map` and `Set` are the names the list below is for.

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
  it to `_framingKeywords`. Unlike `typeof` it never stands where a value
  begins — it opens a tail, after an operand, where no reference may stand —
  so it can stay in the grammar's `identifier` rule and reach the fold,
  which refuses it as a `reserved word` as it refuses `const if = 1;`.
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
walked as a string literal (the drawback below). The alternative, one
unary tag per constructor — `isArray`, then `isMap`, `isSet` — is
cheaper today, since a unary node is one every walker already handles,
and costs a new tag at every consumer for every constructor after, while
the name list grows in one place. The shape is chosen for where the
operator is going, `Map` and `Set`, over the smaller first step.

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
  language can add, and the one node grows to `Map` and `Set` by a name
  each, with no new tag anywhere.
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
  below is cheaper today: it adds no node a walker can get wrong.
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
- [ ] `fjs/compiler/parser/grammar`: `instanceof` in `_framingKeywords`
      and in `relationalTags`; the `types.ts` pins.
- [ ] `fjs/compiler/parser`: `Array` among the reserved words the fold
      refuses as a binding, with proofs for a `const`, a parameter, a key
      and a property name; the fold's arm for the tag — the right operand
      admitted only as a reference to `Array`, anything else refused with
      the rule's message — the AST node, the lowering to
      `['instanceof', exp, 'Array']`. The pull request declares the
      breaking change.
- [ ] `fjs/compiler/ast`: the eager walk's arm for the AST node, one
      operand as the prefixes have, so `anchors` reaches through it.
- [ ] `fjs/compiler/serializer`: the main serializer, the compiler's
      JavaScript output — its tag switch, which refuses a tag it does not
      know, prints `(x instanceof Array)`, and its private operand walker,
      which answers nothing for one, yields `x`, so hoisting sees it; both
      with proofs.
- [ ] `fjs/compiler/serializer/function_text`: `(x instanceof Array)`.
- [ ] `fjs/edag/rust`: `Any::instanceof_(x, Constructor::Array)`;
      `nanvm-lib`: a `Constructor` enum with the one variant, the method as
      one `Dispatch` over `Unpacked`, the README row; the harness operators
      fixture pins it.
- [ ] `fjs/nanvm`: an `instanceof` case set in the corpus, every value kind
      against `Array`.
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

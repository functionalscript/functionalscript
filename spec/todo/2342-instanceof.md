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

The operation exists below the front end in everything but name:
[`fjs/edag/value/semantics`](../../fjs/edag/value/semantics/module.f.mjs)'s
`typeOf` already tells an array value from the rest, and `nanvm-lib`
dispatches on an `Unpacked::Array` variant. What is missing is the EDAG
operation and the syntax.

## Proposal

**Admit `x instanceof Array`, and only that.** The right operand is the
word `Array`; any other right operand is refused. This is the one
`instanceof` the repository uses, and the only one that denotes something
today: the language has no classes
([`3390-class.md`](./3390-class.md)), admits no global as a value
([`2360-built-in.md`](./2360-built-in.md)) and builds no `Map`, `Set` or
`Promise`, so no other constructor has an instance a FunctionalScript value
could be.

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
- **The right operand is the bare word.** `a instanceof (Array)` and
  `a instanceof Array.prototype.constructor` are JavaScript and refused
  here: the grammar reads `'instanceof' id`, and the fold accepts the one
  word. An index is not an expression ([`2340-operators.md`](./2340-operators.md));
  the right operand of `instanceof` is not one either, until it can be.
- **`instanceof` is a reserved word**, as `typeof` is: it names no `const`
  and no parameter, while `{ instanceof: 1 }` and `a.instanceof` are a key
  and a property name as in JavaScript. The tokenizer already hands it over
  as an `id` ([`fjs/js/keywords`](../../fjs/js/keywords/module.f.mjs)); the
  grammar gives it a symbol of its own, as it gave `typeof` one, by adding
  it to `_framingKeywords`. Unlike `typeof` it never stands where a value
  begins — it opens a tail, after an operand, where no reference may stand —
  so it can stay in the grammar's `identifier` rule and reach the fold,
  which refuses it as a `reserved word` as it refuses `const if = 1;`.
- **A module that binds `Array`.** `const Array = 1; export default
  [] instanceof Array;` throws in JavaScript, reading the local. Until
  [`2365-global-names.md`](./2365-global-names.md) refuses the binding
  itself, the fold refuses `instanceof` in a scope where `Array` resolves to
  a binding — the honest answer, since the compiler would otherwise mean
  the global where the source means the local. Once 2365 lands the check
  is unreachable and goes.

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
printer and the writer each dispatch on the tag and read the name. The
alternative, one unary tag per constructor — `isArray`, then `isMap`,
`isSet` — costs the same arms today and a new tag at every consumer for
every constructor after, while the name list grows in one place.

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

- The grammar admits a narrower `instanceof` than it looks like: a reader
  who writes `x instanceof Map` meets a refusal that names the rule, not a
  parse error. That is the price of admitting the useful case before the
  general one, and the refusal says what is missing.
- The `!a instanceof Array` trap is preserved.
- A node shape the EDAG did not have — an operand that is a name — so
  every consumer that walks operands generically learns one node that it
  may not evaluate. The schema makes the name a variant, so a reader that
  forgets is a type error, not a wrong value.
- One more per-operator arm in each consumer, the count
  [`fjs/compiler/todo/unary-tags.md`](../../fjs/compiler/todo/unary-tags.md)
  tracks; collapsing them stays that task's.

## Tasks

- [ ] A draft pull request claiming this file; the approval, recorded here.
- [ ] `fjs/edag`: the `['instanceof', exp, constructor]` node, the
      constructor-name variant with `'Array'` alone, its row in the README
      table, `semantics`' predicate and `operations`' arm; the memo
      analysis reads the name and walks the one operand; the proofs.
- [ ] `fjs/compiler/parser/grammar`: `instanceof` in `_framingKeywords`,
      a relational-level branch `'instanceof' id`; the `types.ts` pins.
- [ ] `fjs/compiler/parser`: the reader's round, the fold's refusal of any
      word but `Array` and of a scope that binds `Array`, the AST node, the
      lowering to `['instanceof', exp, 'Array']`.
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
- [`2365-global-names.md`](./2365-global-names.md) — makes the bound-`Array`
  refusal unreachable.
- [`3390-class.md`](./3390-class.md) — where `instanceof` over a class
  value becomes the node's second arity.
- [`fjs/compiler/todo/unary-tags.md`](../../fjs/compiler/todo/unary-tags.md)
  — the per-operator arms this adds one to.

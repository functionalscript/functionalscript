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

A new unary operation, `['isArray', exp]`, one more tag in `op1Id`
([`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs)). Named for the
built-in it computes, as `is` is named for `Object.is` and `own` for
`getOwnPropertyDescriptor`, not for a source spelling: the writer spells it
`instanceof Array`, and should [`2360-built-in.md`](./2360-built-in.md) one
day admit `Array.isArray(x)` as a call pattern, that is the same node.

The alternative is a binary node, `['instanceof', exp, 'Array']`, with a
constructor name as a structural operand. It mirrors the source and
generalizes to `'Map'` and `'Set'` by one string each, but it is a node
shape no reader has — two `exp`s is what every `op2` consumer walks, and
the schema, the memo analysis, both interpreters, the Rust printer and the
writer would each learn an operand that is not an expression. The unary
tag costs each of them one arm in a switch they already have. When classes
or globals make the right side a value, `instanceof` becomes a true `op2`
over two expressions and `isArray` stays as the special case it is, the
way unary `+` stays beside `Number`.

### Benefits

- The repository's own array test compiles, which every module telling an
  array from an object needs and `structurally_same` needs first.
- No new node shape, no new conversion, no failure path: the smallest
  operator the language can add.
- `nanvm-lib`'s `instanceof` row stops reading as unimplemented for the one
  case the compiler will ever emit.

### Drawbacks

- The grammar admits a narrower `instanceof` than it looks like: a reader
  who writes `x instanceof Map` meets a refusal that names the rule, not a
  parse error. That is the price of admitting the useful case before the
  general one, and the refusal says what is missing.
- The `!a instanceof Array` trap is preserved.
- One more per-operator arm in each consumer, the count
  [`fjs/compiler/todo/unary-tags.md`](../../fjs/compiler/todo/unary-tags.md)
  tracks; collapsing them stays that task's.
- Two spellings of one operation across the layers — `instanceof Array`
  in source, `isArray` in the EDAG — where every other operator has one.
  The precedent is `is` and `own`; the alternative above has one spelling
  and a new shape.

## Tasks

- [ ] A draft pull request claiming this file; the approval, recorded here.
- [ ] `fjs/edag`: the `isArray` tag in `op1Id`, its row in the README table,
      `semantics`' `unary` table and `operations`' `op1` arm; the memo
      proofs.
- [ ] `fjs/compiler/parser/grammar`: `instanceof` in `_framingKeywords`,
      a relational-level branch `'instanceof' id`; the `types.ts` pins.
- [ ] `fjs/compiler/parser`: the reader's round, the fold's refusal of any
      word but `Array` and of a scope that binds `Array`, the AST node, the
      lowering to `['isArray', exp]`.
- [ ] `fjs/compiler/serializer/function_text`: `(x instanceof Array)`.
- [ ] `fjs/edag/rust`: `Any::is_array(x)`; `nanvm-lib`: the method, one
      `Dispatch` over `Unpacked`, the README row; the harness operators
      fixture pins it.
- [ ] `fjs/nanvm`: an `isArray` case set in the corpus, every value kind.
- [ ] `spec/README.md`: the operator — value-type list, precedence list,
      semantics, the keyword's standing as a name; `2340-operators.md`'s
      row **done**; this file deleted.
- [ ] `todo/fjs-nanvm-integration.md`: the two `instanceof` rows point here
      until then.

## Related

- [`2340-operators.md`](./2340-operators.md) — the operator table this adds
  a row to.
- [`2360-built-in.md`](./2360-built-in.md) — `Array.isArray` is listed
  there; this is the same operation under the spelling the repository uses.
- [`2365-global-names.md`](./2365-global-names.md) — makes the bound-`Array`
  refusal unreachable.
- [`3390-class.md`](./3390-class.md) — where `instanceof` over a class
  value would make the operator a true binary one.
- [`fjs/compiler/todo/unary-tags.md`](../../fjs/compiler/todo/unary-tags.md)
  — the per-operator arms this adds one to.

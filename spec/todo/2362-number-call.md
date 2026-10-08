## `Number(exp)`

**Priority:** P2
**Status:** wip
**Approval:** pending — `sergey-shandar`'s, on
[#2666](https://github.com/functionalscript/functionalscript/pull/2666), as
[DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
requires of a language feature.

### Problem

The EDAG has had the conversion since its vocabulary was written:
`['Number', exp]` is an `op1` in [`fjs/edag`](../../fjs/edag/module.f.mjs),
and also the one computed `index` a property access takes,
`['.', a, ['Number', i]]`. Every executor answers it —
[`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs) through
`numericUnary.Number`, the Rust printer as `Any::number`, and the
[`fjs/nanvm`](../../fjs/nanvm/module.f.mjs) corpus holds a `Number` group
checked against JavaScript and the Rust VM, bigints past `2^53` included.
The function-text renderer spells it, so a function holding one converts to
its text.

The language cannot write it. `Number` is a word nothing binds, so
`export default Number("12");` is `const not found`, and the FunctionalScript
writer refuses the node it would never receive (`a Number node`, the
writer's default arm, and `an access key that is no literal` for the index).
The conversion is the one the language needs most: unary `+` is not
FunctionalScript syntax and throws on a `bigint` where `Number` converts
([operators](./2340-operators.md)), and `a[Number(i)]` is the spelling
[property-accessor](./2330-property-accessor.md) has planned for an index the
program knows to be a number since the accessor was first designed —
[`fjs/js/array_index`](../../fjs/js/array_index/module.f.mjs) is a leaf whose
rename waits on the `Number` and `String` globals
([fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md)).

### Proposal

`Number(exp)` is the conversion JavaScript's `Number` performs when called:
`ToNumeric` on the operand, and a `bigint` result made a number. `Number("0x10")`
is `16`, `Number(" 4 ")` is `4`, `Number("")` is `0`, `Number(null)` is `0`,
`Number(undefined)` and `Number("x")` are `NaN`, `Number(true)` is `1`,
`Number(1n)` is `1` and `Number(2n ** 64n)` rounds as JavaScript rounds it, an
array joins and converts (`Number([7])` is `7`, `Number([1, 2])` is `NaN`),
and an object is made primitive as the operators make it — its own `valueOf`
or `toString` called, `"[object Object]"` otherwise, so `Number({})` is
`NaN` ([operators](../README.md#operators)). A function converts to its text,
which is no number. It lowers to the EDAG's `['Number', exp]`, a node like
`~` and `typeof`: nothing folds, since conversion is the executor's question.

**`Number` is a reserved word**, the first name under
[global-names](./2365-global-names.md)' rule: never bound — not by a `const`,
a body `const`, a parameter or an import's local name — and never a value.
It is spelled in one position, as the callee of a call, and refused
everywhere else: bare (`const n = Number;`, `f(Number)`) and as a namespace
(`Number.isFinite(x)`, `Number.MAX_VALUE`). A key and a property name are not
references, so `{ Number: 1 }` and `o.Number` stay what JavaScript has them
as.

Why reserved outright, rather than the intrinsic wherever no scope binds it,
which is how the `entry` helper reads `Object`
([#2661](https://github.com/functionalscript/functionalscript/pull/2661)):
2365 is the design the language already has for its globals, and one name
is the smallest step that lands it. A module may bind `Number` today, so the
rule is a breaking change, declared by the pull request that lands it — no
`.f.js` in the tree binds the word. Reading it as JavaScript's own `const`
where one stands would admit `const n = Number(5); const Number = 1;`, which
JavaScript refuses at the first line, in its temporal dead zone, so the
compatibility rule needs the refusal either way; a reserved word is the one
that costs no scope bookkeeping.

The call's other shapes are JavaScript's, and
[DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
keeps a harmless convention unless a restriction buys something concrete,
which none of them would: `Number()` is `0`, exact, and is read as the
literal `0`, folded as unary `-` over a literal is. `Number(a, b)` and
`Number(...a)` are not refused on principle but **not recognized yet**, each
for want of a representation: `Number(a, b)` establishes `a`, then `b`, then
converts `a`, which is the comma's `(a, b, Number(a))` — the EDAG has the
node and the FunctionalScript writer no spelling for it until the comma
operator lands ([operators](./2340-operators.md)), so admitting it first
would make a program every output but `.js` writes; `Number(...a)` converts
the first value the spread yields, after yielding them all, which no node
expresses while a call's arity is the callee's to split. Both are refused by
name (`Number takes one argument`), never answered with a wrong value, and
each lands with what it waits on. The namespace's members —
`Number.isInteger`, `Number.MAX_SAFE_INTEGER` and the rest — are pure and
wanted, and each is an admission of its own under
[built-in](./2360-built-in.md), with an EDAG node to design first; this task
admits the call alone.

The recognition is the fold's, on the syntax tree with its names resolved
([statement-aware intrinsics](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)):
the grammar already reads `Number(x)` as a call of a reference, and the fold
reads the callee's word before resolving it. The AST carries the conversion
as it carries `typeof`, a tagged node of one operand; the lowering writes
the EDAG node; the FunctionalScript writer spells `Number(e)` back, the
argument a value as any call's is — the one new spelling, since the Rust
printer and the function-text renderer have theirs. The word is refused by
the same check that refuses a keyword, `identifierOf`, consulting a list of
the reserved globals beside `isKeyword` — a list of
[`fjs/js/keywords`](../../fjs/js/keywords/module.f.mjs)' own, not folded into
`keywords`, which the JavaScript tokenizer gives token kinds to: `Number` is
no JavaScript keyword, and must stay an `id` there
([global-names](./2365-global-names.md), open question 3).

**The index**, `a[Number(i)]`, is the task's last step. The grammar's `index`
admits a value in brackets; the fold admits a string, a number or the
conversion and refuses every other expression by name — `a[-1]` and
`a[i]` today are syntax errors, and become `an index is a constant key or a
Number(...) conversion`, the same rule said where it applies. The access's key
is then a string, a number or the conversion node, lowered to
`['.', a, ['Number', i]]`, with a method call through it,
`a[Number(i)](x)`, the receiver-preserving chain as any `.` is. The
prohibited-name check does not reach a converted key: a number's string is
never a prototype's name. The writer spells `[Number(i)]`, the spelling it
refuses today for the round trip's sake. `a?.[Number(i)]` follows once
optional chaining lands ([#2660](https://github.com/functionalscript/functionalscript/pull/2660)).

### Open questions

1. Reserved outright, as proposed, or the intrinsic wherever no scope binds
   the word, as `Object` is in the `entry` helper? The proposal takes 2365's
   rule; the other reading keeps `const Number = 1; Number(2)` JavaScript's
   call of `1`, which nobody needs.
2. `Number()` and `Number(a, b)`: answered by §12, above — `Number()` is
   `0`, and `Number(a, b)` lands with the comma operator, `Number(...a)`
   with a call of runtime arity. Still open: whether either deserves a
   `todo/` row of its own before then, beyond the comma's line in
   [operators](./2340-operators.md).
3. Answered by the task owner: the index is this task's, and lands in
   [#2667](https://github.com/functionalscript/functionalscript/pull/2667)
   with the call.
4. `String(exp)` is the same shape over the EDAG's other cast, and
   `fjs/js/array_index` needs both. A follow-up, filed when this task closes,
   rather than this task's — unless the owner wants the two together.

### Tasks

- [x] This file; the `Number` row of [built-in](./2360-built-in.md) and
      the index entry of [the spec's todo list](./README.md).
- [x] `Number` a reserved word: the list of reserved globals in
      `fjs/js/keywords`, consulted by the parser's `identifierOf`; refused as
      a `const`, a body `const`, a parameter and an import's local name, and
      as a bare reference; accepted as a key and a property name. A
      **breaking change**, declared.
- [x] The conversion: the fold reads `Number(x)` as the AST's conversion
      node and `Number()` as `0`, the lowering writes `['Number', exp]`, and
      the FunctionalScript writer spells it back. Refusals by name for
      `Number(a, b)`, `Number(...a)` and `Number.x`. Proofs: source to EDAG to both
      interpreters against JavaScript, the writer's round trip, the Rust
      output through the existing printer.
- [x] [spec](../README.md): a section for the conversion, the word added to
      the binding rule beside `undefined`, `NaN` and `Infinity`, and the
      expression list; the compiler demos' shared examples, where an
      example reads better with it.
- [ ] The index: the grammar's `index` a value, the fold's refusal by name,
      the key type widened, `a[Number(i)]` and `a[Number(i)](x)` lowered,
      the writer's `[Number(i)]`; the property-access section of the spec
      and [property-accessor](./2330-property-accessor.md) updated; this
      file deleted.

### Related

- [built-in](./2360-built-in.md) — the `Number` row; the namespace's members
  stay unticked.
- [global-names](./2365-global-names.md) — the rule this applies to one
  name, and its open question 3, the list the fold consults.
- [property-accessor](./2330-property-accessor.md) — the index form.
- [operators](./2340-operators.md) — unary `+`, the EDAG operation this one
  differs from on a `bigint`, and the folding line.
- [`fjs/edag`](../../fjs/edag/module.f.mjs) — `op1Id` and `index`, the two
  places the node already stands.
- [#2661](https://github.com/functionalscript/functionalscript/pull/2661) —
  the `entry` helper, whose read of `Object` is the other way to hold a
  global's word, and whose spec text names `a[Number(i)]` as the next step.

## Computed property keys from expressions

**Priority:** P3
**Status:** open

### Problem

JavaScript lets an object literal compute a key from any expression,
`{ [a]: 5 }`. FunctionalScript refuses every computed key but a string
literal:

```js
const a = 0;
export default { [a]: 5 };
```

```
computed.f.js:1:27 - error: unexpected token
```

The refusal is at `a`: the grammar's `member` rule in
[`parser/grammar`](../parser/grammar/module.f.mjs) spells the computed
form as `[`, a `string` token, `]`, so `{ ["x"]: 5 }` is accepted as a
third spelling of the constant key `"x"` and nothing else fits between the
brackets. The spec records the gap
([property keys](../../../spec/README.md#property-keys) and the roadmap's
"computed property key from an expression" in
[`spec/todo`](../../../spec/todo/README.md)), but no `todo/` tracks the
work.

The key is immutable data in the language, so the construct is harmless
([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)):
`{ [a]: 5 }` is `{ 0: 5 }` whenever `a` is `0`, whichever way it is
spelled. Refusing it forces the code to spell the key twice — once where
it is defined and once at every literal that uses it — which is what
[`website/demo/code`](../../website/demo/code/module.f.mjs)'s
`{ [codeMarker]: '' }` avoids, and why that leaf stays outside the compiled
language ([fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md)).

What the key may evaluate to is already decided by the two reads the
language has: `a[Number(i)]` for a number and `entry(a, k)` for a string
([property access](../../../spec/README.md#property-access)). A computed
member needs the same conversion — JavaScript's `ToPropertyKey` — and the
same refusal of every value that is neither, since a symbol has no place in
the language and an object converted through `toString` is a conversion the
language does not perform.

### Proposal

Admit `[` *value* `]` as the key of a member, the value any expression the
language accepts, and keep the three constant spellings as they are:

- `AstMember`'s key, a `string` today
  ([`ast`](../ast/types.ts)), becomes a constant **or** an operand, as
  `AstKey` already is for an access. EDAG's `Property` is `[':', Exp, Exp]`
  ([`edag`](../../edag/types.ts)), so the output format needs no change;
  only the compiler's lowering, the serializer and the Rust output learn
  the non-constant key.
- The key's value is converted as a property key: a number or a string is
  the key; every other value is refused, at run time as the VM refuses an
  unsupported value, and at compile time where the parser already sees a
  literal of another type.
- A key computed from a string literal keeps folding to the constant, so
  the three constant spellings and the existing `__proto__` rule, which is
  about the plain and quoted spellings of that one key, are untouched.
- A numeric key written plainly, `{ 0: 5 }`, is refused today at the
  number; it is the roadmap's "property key as number" and the same
  conversion serves it. Whether it lands in this change or its own is the
  implementer's call.

### Tasks

- [ ] grammar: the computed member takes a `value` between the brackets
- [ ] syntax and parser: a member whose key is a node, folded through the
      same frame an access's `Number(...)` key uses
- [ ] AST, EDAG lowering, serializer and Rust output: a member with an
      operand key
- [ ] interpreter and VM: `ToPropertyKey` on a number or a string, refusal
      of every other value
- [ ] spec: property keys and the roadmap item
- [ ] proofs: the example above, a string-valued key and a refused value

### Related

- [spec: property keys](../../../spec/README.md#property-keys) — states the
  restriction this issue lifts.
- [spec roadmap](../../../spec/todo/README.md) — "computed property key
  from an expression" and "property key as number".
- [fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md) — the
  `website/demo/code` leaf waits on this.
- [PR 2826](https://github.com/functionalscript/functionalscript/pull/2826)
  — rewrote the leaves' computed reads and noted the object-literal key has
  no spelling the language accepts.

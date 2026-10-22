## Computed property keys from expressions

**Priority:** P2
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
([property keys](../../../spec/values/objects/README.md#property-keys) and the roadmap's
"computed property key from an expression" in
[`spec/todo`](../../../spec/todo/README.md)), but no `todo/` tracks the
work.

The key is immutable data in the language, so the construct is harmless
([DESIGN.md §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)):
`{ [a]: 5 }` is `{ 0: 5 }` whenever `a` is `0`, whichever way it is
spelled. Refusing it forces the code to spell the key twice — once where
it is defined and once at every literal that uses it — which is what
[`website/demo/code`](../../website/demo/code/module.f.js)'s
`{ [codeMarker]: '' }` avoids; that leaf compiles now and is an `.f.js`
([fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point)).

What the key becomes is already decided below the compiler. EDAG's
`Property` takes any expression as its key
([`edag`](../../edag/types.ts)); the interpreter converts the value with
`ToString`, as the `entry` helper converts the key it reads
([reading an entry at run time](../../../spec/property-access/entries/README.md)),
and `nanvm-lib`'s `computed_item`
([`vm/unstable`](../../../nanvm/lib/src/vm/unstable/mod.rs)) does the same
through `Any::to_string`. That is JavaScript's `ToPropertyKey` on every
value the language has — a symbol, the one case it treats apart, has no
spelling here — so `[1]` is the key `"1"`, `[null]` the key `"null"`, and
`[[1, 2]]` the key `"1,2"`. The compiler's job is to hand the key's node
down; it adds no conversion and no refusal of its own, which would make
the source form diverge from the graph the VM already runs.

### Proposal

Admit `[` *value* `]` as the key of a member, the value any expression the
language accepts, and keep the three constant spellings as they are:

- `AstMember`'s key, a `string` today
  ([`ast`](../ast/types.ts)), becomes a constant **or** an operand, as
  `AstKey` already is for an access. EDAG's `Property` is `[':', Exp, Exp]`
  ([`edag`](../../edag/types.ts)), so the output format needs no change;
  only the compiler's lowering and the serializer learn the non-constant
  key. The Rust output prints one already: a property whose key is no
  string goes through `computed_item` in
  [`edag/rust`](../../edag/rust/module.f.mjs)'s `propertyExpr`, which the
  compiler's Rust output delegates to.
- The key's value is converted where the object is built, by the
  interpreter and the VM as they already do: `ToString` on every value,
  and the literal fails where that conversion does — an object whose
  `toString` throws or yields no primitive, `{ [{ toString: 0 }]: 1 }` —
  as `computed_item` propagates its `to_string` error and
  [`edag/memo`](../../edag/memo/proof.f.mjs)'s `keyFailure` pins for the
  interpreter. The compiler refuses nothing of its own and passes the node
  through, so the constant spellings and the computed one meet the same
  contract.
- A key computed from a string literal keeps folding to the constant, so
  the three constant spellings and the existing `__proto__` rule, which is
  about the plain and quoted spellings of that one key, are untouched.
- A numeric key written plainly, `{ 0: 5 }`, stays refused at the number.
  It is the roadmap's own "property key as number" item, a second feature
  with a grammar change of its own, and lands in its own pull request;
  `{ [0]: 5 }` spells the same object through this one.

#### Drawbacks

The feature is one more shape in every consumer of a member — the syntax,
the parser's container frame, the lowering, the serializer — and it costs
the language three things a constant key did not:

- **An object's keys are no longer readable from its literal.** Every
  reader that answered "which keys does this object have" from the source
  — a type in `types.ts`, a reviewer, the serializer's reconstruction of a
  value, `rtti` — now meets a literal whose keys exist only once it is
  evaluated. Duplicate keys, which a constant literal shows, are decided
  at run time too: `{ [a]: 1, [b]: 2 }` has one member or two.
- **The conversion surprises.** `{ [{}]: 1 }` is `{ "[object Object]": 1 }`,
  `{ [[1, 2]]: 1 }` is `{ "1,2": 1 }`, and `{ [0.5]: 1 }` is `{ "0.5": 1 }`
  — JavaScript's answers, and the ones the VM already gives for
  `entry(a, k)`, but a reader who meets them in a literal may not expect
  them. The spec has to say them out loud.
- **The outputs split.** A graph output, `.f.js` or `.rs`, keeps the
  brackets, `{ [k]: v }`, while a value output, `.json` or `.data.js`,
  writes the key the value has, so a module no longer reads the same in
  both. `fjs/edag/rust`'s corpus mode has no Rust for a computed key at
  all (`no Rust for computed object keys in corpus mode; use scope`), which
  the module output avoids by printing every node in its own scope.

Against these: the construct is JavaScript's, the VM runs it already, and
refusing it costs every module that builds a key from a `const` a second
spelling of that key. What the restriction bought, a literal's keys at a
glance, is kept wherever the key is a constant, since a constant computed
key folds to the constant spelling.

### Tasks

- [ ] grammar: the computed member takes a `value` between the brackets
- [ ] syntax and parser: a member whose key is a node. The access path
      does not serve: `keyEntered` admits only a node it recognises as
      `Number(...)`, and `_IndexFrame` closes into an `AstAccess`, not a
      member. The container frame instead reads a computed member in two
      rounds, the key's and then the value's, keeping the key's value
      between them and building the member itself — after the members
      before it and before its own value, as JavaScript evaluates a literal
- [ ] AST, EDAG lowering and serializer: a member with an operand key
- [ ] interpreter, VM and Rust output: nothing, all three take the key
      already; proofs that the compiled form reaches them
- [ ] spec: property keys and the roadmap item
- [ ] proofs: the example above, a string-valued key, a key of each other
      type and the string it converts to, a key whose conversion fails and
      the literal failing with it, and a computed key that evaluates to
      `"__proto__"`, which defines an own property as JavaScript does

### Related

- [spec: property keys](../../../spec/values/objects/README.md#property-keys) — states the
  restriction this issue lifts.
- [spec roadmap](../../../spec/todo/README.md) — "computed property key
  from an expression" and "property key as number".
- [fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md) — the
  `website/demo/code` leaf waited on this, and is converted.
- [PR 2826](https://github.com/functionalscript/functionalscript/pull/2826)
  — rewrote the leaves' computed reads and noted the object-literal key has
  no spelling the language accepts.

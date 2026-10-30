## The `in` Operator With a Literal Key

**Priority:** P3
**Status:** wip — approved by the language designer, below

### Problem

FunctionalScript has no `in`. `"a" in o` is a compilation error, and the
previous version of this record made the refusal permanent, for two reasons:
answering for own entries only gives `"toString" in {}` a different result
than JavaScript's `true`, which breaks the first rule of the
[principles](../principles/README.md); and a dynamic key, `k in o`, cannot be
refused at compile time the way the read `o.toString` is.

Both reasons hold for the operator JavaScript has, and neither holds for the
operator this record admits: `in` with a **string literal** on the left that
names no property a built-in prototype gives a value. For such a key the
prototype chain has nothing to say, so the own-entry answer *is* JavaScript's,
and the key is in the source, so the compiler refuses the names it would
answer wrongly, as it refuses them as the key of a read.

What the language gains is the constant-key spelling of presence. A read has
two: the constant key, `o.x` and `o["x"]`, and the computed key,
`entry(o, k)` ([reading an entry](../property-access/entries/README.md)).
Presence has only the computed one, `hasEntry(o, k)`, so the common question,
whether an object holds a field the program named, is a helper call where the
read beside it is an access. `"x" in o` is the missing form, and it is
JavaScript's own.

### Proposal

**Syntax.** `"k" in o`: the left operand is a string literal, bare or in
parentheses as `instanceof`'s right operand may be, since a group vanishes
([`instanceof`](../operators/instanceof/README.md)); the right operand is any
value. `in` is a relational operator, one level with `<` and `instanceof`
and left-associative as they are, so `1 < "a" in o` is `(1 < "a") in o` in
JavaScript, and is refused here because its left operand is no literal;
`"a" in o in p` is refused the same way. Any other left operand — a
reference, an access, a number, a template — is refused at the operator
(`the left operand of in must be a string literal`), the message naming
`hasEntry` as the spelling for a computed key, as the computed read's names
`entry`. A numeric literal is refused too: the key is written as the string
it names, `"0" in a`, one rule rather than two. The word `in` stays reserved
([lexical grammar](../lexical/identifiers/README.md)); `for (k in o)` is a
different grammar and stays refused, as before.

**The key rule.** The literal may not be a name in `prototypeNames` of
[`fjs/js/prototype`](../../fjs/js/prototype/module.f.js), the inventory a
read's key is checked against, and the refusal is the read's,
`prohibited property name`, with the read's one exemption, `length`, which
an array, a string and a function own: `"length" in []` is `true` in
JavaScript, and the body answers it so, reading the `length` of an array
and a function as the read does. (As first proposed, `in` refused `length`
because the helper did not count it; the designer decided in the session
that `.` and `in` read `length` where `entry` and `hasEntry`, which list
what `Object.entries` lists, do not, so the key rule is the read's, and the
operator and the helper are two implementations by design.) Every other
name whose answer would differ — `name`, `caller` and `arguments` on a
function, `__proto__` and `constructor` on everything — is in the
inventory already. An index-like string, `"0"`, is an ordinary key.

**Semantics.** For an object, an array or a function, `"k" in o` is
`hasEntry(o, "k")`, or `true` for the `length` an array and a function
own: `true` for an enumerable own entry, one holding `undefined` included,
`false` otherwise. For `null`, `undefined` and every
primitive it throws, as JavaScript's `TypeError` does; the thrown value's
text is free, since [failure is one outcome](../principles/README.md#failure-is-one-outcome).
This is JavaScript's answer for every value the language can build: a
FunctionalScript value owns no non-enumerable string key outside the
inventory, and the chain adds only inventory names, so for an admitted key
JavaScript finds the property exactly where `hasEntry` finds it. The
agreement is the declared profile's, ECMAScript 2025, as the read rule's is.

**The EDAG node.** `['in', key, exp]`, in the operator family beside
`instanceof`: the key is a string *spelling*, chosen at compile time and
never evaluated, not an operand, as `instanceof`'s constructor name is a
name. A reader walking operands generically needs an arm for it, as it has
one for `instanceof`. The FunctionalScript writer prints it back as
`"k" in o`; the Rust writer prints a call of the runtime's body below, and
`nanvm-lib` substitutes a native answer, `Any::in_`, one `Dispatch` over
`Unpacked` as `instanceof_` is ([DESIGN.md §13](../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
Not a helper as a value: `['entry']` is a function a module writes and may
pass, where `in` is an operator with a fixed operand set, no value, and
nothing the writer could print alone.

**The runtime body.** The semantics is one FunctionalScript function in
[`fjs/js/runtime`](../../fjs/js/runtime/module.f.js), a third export of
`runtime` beside `static` and `dot`, in the operator's operand order:

```js
in: (key, self) => {
    if (self === null || typeof self !== 'object' && typeof self !== 'function') { throw 'in: not an object' }
    return hasEntry(self, key) || key === 'length' && (self instanceof Array || typeof self === 'function')
},
```

The receiver check is the one `Object.fromEntries` makes there already. The
body uses `hasEntry`, not `in`, so the core's rule that it may not use what
it defines holds, and the backend's primitive surface does not grow. Its
contract is the key rule above: given a prototype name it would answer
`false` where JavaScript says `true`, which no run-time check can prevent,
so the parser keeps the rule and the proof checks the body against the
host's own `in` on admitted keys alone, and its throw on every primitive.
The Memo and Amnesia interpreters answer the node by calling the body;
`nanvm-lib` substitutes `Any::in_`, and the generated runtime
(`nanvm/lib/src/vm/gen.runtime.rs`) carries the body as it carries the
statics.

**Why not desugar.** The compiler could expand `"k" in o` into nodes that
exist — a conditional over `typeof o`, a `hasEntry` call and a `throw`,
the DAG sharing `o`. That puts the semantics in the compiler's lowering
instead of the runtime, which §13 forbids; the writer could not print it
back as `in`; and a Rust substitution would have to recognise the
expansion's shape, which §13 calls a sign the source should expose the
shape instead. The node is that shape.

### Alternatives rejected

| Alternative | Why not |
|---|---|
| `in` with any key, answered for own entries | `"toString" in {}` and `k in o` for a prototype name differ from JavaScript's successful result (principles, rule 2) |
| `in` with a built-in `Object.prototype` | Reintroduces the prototype chain and makes names like `toString` observable |
| `in` by receiver-type dispatch, any key | Compatible within the profile, but it answers as data a name whose read the language refuses, and the dynamic key cannot be refused at compile time |
| Desugar to `hasEntry` alone | `"0" in "str"` answers `true` and `"x" in 1` answers `false` where JavaScript throws: a successful value in place of a required failure |
| Desugar into existing nodes, with the receiver check | Semantics in the compiler rather than the runtime (§13); no round trip to `in`; a substitution keyed on a body's shape |
| `['in']` as a function value, like `['entry']` | An operator is no value: a module cannot write `in` alone, and the writer has nothing to print for it |
| A numeric literal key, `0 in a` | A second key rule for a key `"0"` already spells |
| Keep the refusal | The reasons for it were the chain and the dynamic key, and the literal-key operator has neither; the restriction prevented no mistake a literal key can make ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)) |

### Tasks

- [x] The [§12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
      approval record. **Approved** by the language designer,
      `sergey-shandar`, in
      [the working session](https://claude.ai/code/session_01Q2nX9tTC5wXtzE7LHJXgRs):
      the designer proposed the literal-key operator there, decided for it
      ("I like the operator. Let's do it."), and, asked whether a sole
      designer's own decision stands as the §12 record where the section
      names no second designer to ask, directed that the decision be
      recorded as the approval. That is the owner's resolution of §12's
      "another designer" for a proposal of the only designer named.
- [x] The runtime body `runtime.in` and its proof against the host's `in`:
      every admitted key on an object, an array and a function, an entry
      holding `undefined`, and the throw on `null`, `undefined` and each
      primitive; `npm run gen` for the generated runtime.
- [x] The EDAG node `['in', key, exp]`: `fjs/edag` (`module.f.mjs`,
      `types.ts`, the README row), the AST's operand walks in `fjs/js/ast`,
      the FunctionalScript writer, the Rust writer printing the runtime's
      body, and the interpreters' answer in `fjs/edag/operations`, a call
      of the runtime's body, each with its proof.
- [x] The parser: the grammar reads `in` at the relational level as it
      reads `instanceof`; the fold checks the left operand is a string
      literal and applies the key rule, the read's; the
      `refusedByDesign` entries of `operators.proof.f.mjs` for `a in b`
      move to the accepted forms, and `for (k in o)` stays pinned refused.
      `npm start compile` from the root.
- [x] `nanvm-lib`: the corpus groups `in "x"` and `in "0"` in `fjs/nanvm`,
      proving the naive spelling — the runtime's body called through the
      runtime value — against the host on both sides, the operator's row
      in `nanvm/lib/README.md`, and the runtime's module comment. A native
      `Any::in_` is a substitution rule, not an implementation (DESIGN.md
      §13), filed as `nanvm/lib/todo/in-native-substitution.md` and taken
      when a measurement asks for it; one implementation for the operator
      and the helper is no option, since `hasEntry` lists enumerable
      entries alone, as `Object.entries` does, where `in` reads `length`.
- [ ] The specification: [`in`](../operators/in/README.md) becomes the
      operator's page, implemented, with a sample and the demo, the refused
      page and its `alternative.f.js` gone; the `op.in` row of
      [refused constructs](./refused-constructs.md) deleted; the roadmap entry
      ticked; the sentence "presence has no other spelling" of
      [reading an entry](../property-access/entries/README.md) and the
      `in` mention of [property access](../property-access/README.md)
      updated; the `in` row in [operators](../operators/README.md). This
      step deletes this file.

Proposed order of the stack: the runtime body first, a pure addition the
host proves; then the node with the interpreters and writers; then the
parser, which makes the operator reachable from source; then `nanvm-lib`;
then the specification. The node and `nanvm-lib` could swap; the parser
cannot come before the node.

### Related

- [Undefined-valued properties](./1010-undefined-property.md) — `"x" in { x: undefined }` is `true`, the distinction that record keeps visible.
- [Reading an entry at run time](../property-access/entries/README.md) — `hasEntry`, the computed-key spelling of the same question, and the body's primitive.
- [`instanceof`](../operators/instanceof/README.md) — the operator precedent: a relational operator with a syntactically closed operand carried as a spelling.
- [Operators](../operators/README.md).
- The previous version of this record, which refused the operator and whose reasons the alternatives above answer, is in the file's history before this change.

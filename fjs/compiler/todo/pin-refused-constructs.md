## Pin the constructs the compiler refuses

**Priority:** P3
**Status:** open

### Problem

The language is a whitelist ([principles](../../../spec/README.md#principles)):
a JavaScript construct is accepted only as part of a recognized pattern, and
every other is a compilation error. A refusal is therefore as much a part of
the language's contract as an accepted form, and an accepted form is pinned
with its exact result. A refusal should be pinned the same way, with its message
and the column it is reported at, so that admitting a construct by accident, or
moving its error, fails a proof.

Some refusals are pinned that way, in the parser's `refused` tables and the
grammar proof's `read` expectations. Many are not. The specification names a few
operators as refused on purpose, and the first review of the `in` decision found
`==` and `!=` among them with no proof at all. There is also no single list of
what is refused, so nothing says which refusals are deliberate and which only
await work.

This inventory is the starting point. It was measured at `af598909f`
(main when the survey ran): each construct was compiled as the `default` export
of a one-line module and the first error read back. The "pinned" column comes
from a text search of the compiler's and tokenizer's proofs for a refusal naming
the construct. A text search proves nothing about absence, so "not found" is a
lead to confirm, not a verdict; "yes" names the proof that was read.

### Inventory

Status: **by design** is a refusal the specification states is permanent;
**planned** has a roadmap or `spec/todo` entry; **no statement** is a refusal
the specification does not mention, which follows from the whitelist and says
nothing on whether it is permanent.

#### Operators and expressions

| Construct | Status | Compiler says | Pinned |
|---|---|---|---|
| `==`, `!=` | by design (`2340-operators`) | unexpected token, at the operator | yes, `operators.proof` |
| `in` | by design (`2346-in-operator`) | unexpected token, at the `in` | yes, `operators.proof` |
| `instanceof` other than `Array` | by design (`Object`, `Function` never) | the right operand of instanceof must be Array | yes, `operators.proof` |
| comma operator | planned (`2340-operators`) | unexpected token | yes, grammar proof |
| `delete`, `void`, `new` | no statement | unexpected token | not found |
| `++`, `--`, `+=` and other compound assignment | planned (`3430-assignments`) | unexpected token | not found |
| `=` outside a loop's block | planned (`3430-assignments`) | unexpected token | yes, grammar proof |
| `this`, `super`, `eval`, `arguments` | `this`: by design (`design-principles`); the rest no statement | reserved word | not found |
| `yield`, `await` as expressions | planned (`promise`, `async/await`) | unexpected token | not found |
| `import(...)`, `import.meta` | no statement | reserved word | not found |
| regular-expression literal | planned (roadmap, priority 3) | unexpected token | not found |
| tagged template | untagged templates are in the language; tagged is not mentioned | unexpected token | yes, grammar proof |
| a computed key that is not `Number(...)`, `a[i]` | by design (`2330-property-accessor`) | computed key is not Number(...) | yes |
| a prototype name as a key, `a.toString` | by design (`2330-property-accessor`) | prohibited property name | yes |
| a prototype member function call, `a.push(0)` | by design (`2360-built-in`) | prohibited member function | yes |
| a global such as `Math`, `JSON`, `Object`, `globalThis` | no statement beyond `2360-built-in` | const not found | the general `const not found` is pinned; no specific global found |

#### Statements and declarations

| Construct | Status | Compiler says | Pinned |
|---|---|---|---|
| `let` and `while` outside the one-variable loop | planned (`3220-let`) | let without while, while without let, and the rest | yes, parser proof |
| `else`, an unbraced `if` | planned (roadmap, `if` follow-ups) | unexpected token | yes, grammar proof |
| `for`, `for...of`, `do...while`, `break`, `continue` | planned (`3220-let`) | unexpected token | `for (k in o)` only; the rest not found |
| `switch`, `try`, `with`, `debugger`, labels, `var` | no statement | unexpected token | not found |
| `class` | planned (`3390-class`) | unexpected token | not found |
| `function` declaration or expression, `async`, generators | no statement | unexpected token | not found |
| getters, setters, method shorthand, private names | no statement | unexpected token | not found |
| a parameter default, `(a = 1) => a` | `3120-parameters` mentions defaults only as a later possibility | unexpected token | yes, grammar proof |
| `export *`, `export { a } from`, namespace import | planned (`2220-namespace-import`, `export-lists`) | unexpected token | `export { a };` and `export let` only as "an error", not by message |
| a numeric property key, `{ 0: 1 }` | planned (roadmap, property key as number) | unexpected token | not found |
| a plain `__proto__` key | by design (`2330-property-accessor`) | `__proto__` requires the computed key form | yes, parser proof |

#### Literals

| Construct | Status | Compiler says | Pinned |
|---|---|---|---|
| octal, `0o7`, and a legacy octal, `010` | by design (`2470-binary-literals`: "octal remains unsupported") | unexpected token | the tokenizer's number cases refuse malformed binary; a parser-level octal refusal not found |
| a string line continuation | planned (`2460-js-string-literals`) | unexpected token | the tokenizer pins its reading; the compiler's refusal not found |

#### What the survey did not cover

The inventory is a sample of what a JavaScript program may contain, not a
complete grammar walk. It leaves out the cases that need a context to be
meaningful (several `export default`s, a name used before its `const`), the
`.f.js` extension's own checks, and the refusals the other compilers make (the
`.json` output refusing `undefined`, the Rust output refusing a function it
cannot name). A complete list needs the specification to state one; the sections
above are the places its refusals appear today.

### Proposal

1. **State the refusals in one place.** The specification's operators section
   and its roadmap each name some. A short list in the specification, each
   entry marked by design or planned and linked to its record, would answer
   which refusals are deliberate. The `in` and `==` / `!=` entries already
   exist; the rest need a status decision from the language designer, so the
   list records "no statement" until one is made and does not invent one.
2. **Pin each by its message and column.** A table-driven proof, one row per
   construct with its source, message and column, in the style of the existing
   `refused` tables. A construct that later becomes accepted moves from the
   table to the accepted-form proofs in the pull request that admits it, so
   the table shrinks as the language grows and a refusal can never be admitted
   without a proof changing.
3. **Keep a refusal's reason beside it.** A comment on each row naming the
   record that explains it, as the `in` rows do, so a reader who sees a row
   fail knows whether the construct was meant to stay out.

### Tasks

- [ ] Confirm each "not found" in the inventory: search the proofs for a refusal
      that pins it, and keep the ones that are.
- [ ] Pin the by-design refusals first: `delete`, `void`, `new`, `this`, and
      the compound assignments and `++` / `--`, where the specification or a
      record states why.
- [ ] Pin the planned refusals, a row each, with the record that plans them.
- [ ] Decide, with the language designer, which "no statement" refusals are
      permanent, and record the answer where the specification lists them.
- [ ] Check the one possible gap the survey turned up: octal (`0o7`) is refused
      by design for numbers, while `0b` and `0x` are accepted. State the
      reason in the specification if there is one
      ([design principles §12](../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).

### Related

- [The `in` decision](../../../spec/todo/2346-in-operator.md), whose refusal
  proof is the model for the rest.
- [Operators](../../../spec/todo/2340-operators.md) and the specification's
  [principles](../../../spec/README.md#principles).

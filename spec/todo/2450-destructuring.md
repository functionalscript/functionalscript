## Destructuring in `const` and parameters

**Priority:** P2
**Status:** open — design proposed; language-design approval pending

```js
const { a, "%": [c, d] } = { a: null, "%": [true, false] };
const f = ([x, { y }], z) => [x, y, z];
export default { a: [a, c, d], f };
```

A binding pattern — an object pattern, an array pattern, or a name, nested
freely — where a `const` or a parameter takes a name today. The semantics are
JavaScript's, reached without a new EDAG node: every name a pattern binds
lowers to a property read, and an array pattern to the spread the language
already has.

### Problem

The compiler takes one name per `const` and per parameter, and refuses a
pattern in either position — a parameter list whose head is no name is
recorded as `invalid` by the syntax reader and refused as malformed, and a
`const` of `{` or `[` stops at the grammar. The restriction protects nothing:
a pattern is a familiar JavaScript convention with a one-to-one lowering to
reads the language performs already, so keeping it out is the kind of
restriction [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
asks to justify, and nothing justifies it.

It is also the largest single obstacle to converting authored modules
([CONVERTING.md](../../doc/CONVERTING.md)): at `470dea8f`, the authored
`.f.mjs` modules under `fjs/` held about 2,300 destructuring `const`s in
some 280 files, and about a thousand destructuring parameters. Each has to
be rewritten as one `const` per name before the module can become a
compilable `.f.js`.

### Proposal

#### Syntax

A **binding target** is one of

- a name, under the [binding rule](../README.md#shared-values-constants) a
  `const` and a parameter already follow;
- an **object pattern**, `{ p, … }`, each property a shorthand name `a`, or
  a key and a target, `a: t`, `"a": t`, `["a"]: t`, `[3]: t`, with the
  trailing comma an object literal allows;
- an **array pattern**, `[t, …]`, each item a target, with the trailing
  comma an array literal allows.

A target stands where a `const` takes its name, exported or not, and where
a fixed parameter takes its name — the first of a list, `({ a }) => …`, and
each one after a comma, `(a, [b]) => …`. A rest parameter keeps a plain
name. The name a pattern binds is a `const` or a parameter by every
existing rule: reserved words, duplicates within one pattern, across a
parameter list, or against a body declaration, and the capture-shadowing
rule are refused as they are for a plain name; `export const { a, b } = p;`
exports `a` and `b`, and `then` is refused among them as it is alone.

**Not in this stage**, each refused with an explicit message rather than
read partially ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):

- a **rest element**, `[a, ...r]` and `{ a, ...r }`, and a pattern under
  the rest parameter, `(...[a, b]) => …`. The array form is cheap — the
  spread array below, sliced past the fixed items — and is the next stage;
  the object form needs "the own properties but these", which no node
  spells, and gets a node or a helper of its own when it comes;
- an **elision**, `[, b]` and `[a, , c]`, which skips a position of the
  iteration — a read the spread lowering gives for free, the element after
  it taking the next index, `$0[1]`, so nothing is a hole. What it costs
  is the grammar: an array literal has no elision, since an array of this
  language has no hole ([arrays](../README.md#arrays)), and the pattern is
  read as the literal is, so the literal rule would have to admit the
  elision for the fold to refuse it in a value and read it in a pattern.
  That is the next stage with rest, and no rule of the language: an
  elision in a pattern is harmless JavaScript
  ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions));
- a **default**, `{ a = 1 }` and `[a = 1]`, deferred with default
  parameters ([named and rest parameters](./3120-parameters.md)), since
  both lower to the same `undefined` test and are best designed once. The
  two differ on `length`, and the follow-up must keep them apart: a
  default on a parameter itself ends JavaScript's count, so
  `((a = 1) => 0).length` is `0`, while a default nested inside a
  pattern does not, so `(({ a = 1 }) => 0).length` and
  `(([a = 1]) => 0).length` are both `1` — the pattern stays one fixed
  parameter whatever its elements default to. Neither spelling parses
  today: `=` is no operator in a literal, so there is nothing to refuse
  by hand;
- a **computed key** beyond a constant. A string or a number literal
  standing alone in the brackets, `{ ["a"]: t }` and `{ [3]: t }`, is the
  constant key an access admits in brackets, `o["a"]` and `o[3]`
  ([property access](../README.md#property-access)), and is read as
  `"a": t` is — by the literal's spelling, so `{ [1.0]: t }` names `"1"`
  as `o[1.0]` does, and a grouped literal, `{ [(3)]: t }`, is no constant
  as `o[(3)]` is none. Every other computed key is refused for now
  (`computed key in a binding pattern not supported`), the conversion
  `Number(i)` an access admits included: the fold resolves a statement's
  value as one walk over an explicit stack, and a key would be a second
  value to resolve inside the statement, at every nesting of the pattern —
  machinery a conversion key, rare in a pattern, does not yet earn. A key
  of any type is the `entry` helper's to read
  ([reading an entry at run time](../README.md#reading-an-entry-at-run-time)).

Until then an elision stops at its second comma, as it does in an array
literal.

#### Semantics, by lowering

A pattern is sugar over reads the language has, so it adds no rule to the
specification beyond the sentence that says so, and each of its properties
is the property of the read it lowers to:

- **The initializer is evaluated once**, as a hidden `const` of the body —
  a module's, a function's, or a guard's arm — and every read of the
  pattern is a read of that one value.
- **An object pattern's property is a property access**, `{ k: t }` of a
  source `s` binding `t` to `s.k`, under every rule of
  [property access](../README.md#property-access): a `null` or `undefined`
  source throws as JavaScript's `RequireObjectCoercible` throws, a
  primitive source yields `undefined` for a property it does not own, as
  `GetV` does through `ToObject`, and a key a built-in prototype gives a
  value — `toString`, `constructor`, `__proto__` — is the compilation error
  the access is (`prohibited property name`). JavaScript would read a
  function or a prototype there and this language nothing, and a module
  must mean one thing in both. `length` is the exception, as it is for the
  access: `const { length } = xs;` reads it.
- **An array pattern is a spread.** `[t0, t1]` of a source `s` binds a
  hidden `const` to `[...s]`, and `t0` and `t1` to its elements `0` and
  `1`. This is JavaScript's own semantics, which run array destructuring
  through `GetIterator` as they run a spread
  ([spread](../README.md#spread)): a source that is not iterable throws
  the same `TypeError` (`const [a] = {};` fails, as it does in
  JavaScript), and a string yields its code points, so `const [a] = '😀';`
  binds the two-unit string. The spread reads every element where
  JavaScript's destructuring reads the first two; nothing in this language
  can observe the difference — there is no generator, no side effect and
  no infinite iterable — so the array is the one cost, and it is paid for
  simplicity, not optimized away before it is measured
  ([DESIGN.md §1](../../doc/DESIGN.md#1-simplicity-first)).
- **Every read is established, read or not.** `const { a: { b } } = {};`
  throws in JavaScript whether or not `b` is used, so each hidden
  intermediate and each bound name is an entry of the body, kept by the
  comma node as an unread `const` already is
  ([shared values](../README.md#shared-values-constants)). The order among
  the reads of one pattern is no promise, since all are pure and only
  which failure fires first could tell them apart
  ([failure is one outcome](../README.md#failure-is-one-outcome)).
- **An empty pattern binds nothing and keeps its failure**, the check
  `([]) => 0` and `({}) => 0` give a caller in JavaScript, which is a use
  and not a mistake, so [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
  has no restriction to justify. `[]` is the spread of its source alone,
  failing where the source is not iterable. `{}` is one read of its
  source, its `length` — the one name every kind of value may own —
  binding nothing: the read that fails on `null` and `undefined` as
  `RequireObjectCoercible` fails, and whose value is no observation. The
  graph outputs write the two reads, `const $0=[...v];` and
  `const $0=v.length;`.
- **A parameter pattern counts as one fixed parameter** toward `length`
  and toward the limit of 16, as JavaScript counts it, and its reads are
  the first entries of the function's body, the fixed argument their
  source. A function's `self` is unaffected: a destructured `const` never
  names a function as its whole value.
- **Captures are unchanged.** A name a pattern binds is a `const` or a
  parameter of its body, captured, shadowed and refused as one.

The graph outputs write the lowered form: `const [c, d] = v;` is written
`const $0=[...v];const c=$0[0];const d=$0[1];` with fresh names where the
source's are gone — the precedent `if` set when it lowered to `?:`. The
EDAG, the interpreters, the Rust writer and NaNVM see property reads and a
spread they already answer; nothing changes below the compiler.

#### Rejected alternatives

- **An array pattern as index reads**, `s[0]`, `s[1]`, with no spread: a
  plausible wrong value for a string with an astral character and a silent
  success on an object JavaScript refuses. Rule 2 of the
  [principles](../README.md#principles) and DESIGN.md §10 both forbid it.
- **A destructuring node in the EDAG**: a schema change, two interpreters,
  the analysis, the Rust writer, NaNVM and both serializers, for a reading
  the spread and the access give exactly. It stays open as an optimization
  the measurement for which does not exist.
- **Dedicated pattern rules in the grammar**: a second spelling of the
  object and array shapes. The parenthesized parameter list is read as a
  value already — one symbol cannot tell `({ a }) => 1` from `({ a })`
  before the `)`, and JavaScript's own cover grammar reads it the same way
  — so the one converter from a parsed value to a target serves `const`
  too, with one set of errors.

#### Implementation shape

1. **Syntax tree.** The `const`'s and the parameter's name become a target
   in [`parser/syntax/types.ts`](../../fjs/compiler/parser/syntax/types.ts),
   the opening token kept for errors. The reader builds the target *beside*
   the node, one mapping at a time, as JavaScript refines its cover grammar:
   each value's mapping records the target the same text is — a name, a
   pattern of its items' targets, or `invalid` at the token a value that is
   no target begins with — and an item's or a member's mapping reads it off
   the value's output symbol, where the `paren` id still says a `(` opened
   it. A converter run on the finished node could not: `nodeAt` erases the
   group, since a group is no node, and `[(a)]` and `{ a: (b) }`, which
   JavaScript refuses in a binding pattern, would pass. The list's head,
   today `namedList`, reads the same target.
2. **Grammar.** Two productions widen in
   [`parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs):
   `constStatement`'s name position and `parameterNames`' fixed names take
   an object or an array as the value rules read them. `{`, `[` and an
   identifier begin nothing else in either position, so the grammar stays
   LL(1), which its proof checks.
3. **Binding.** One function in [`parser`](../../fjs/compiler/parser/module.f.mjs)
   binds a target against a source reference, appending the hidden and the
   named entries to the body being built and extending the scope — used
   where a module `const`, a body `const` (`bodyRound`) and a parameter
   list (`functionScope`) bind a name today. Lowering, the EDAG and the
   writers need no change.
4. **Proofs.** Parser proofs for the syntax tree and every refusal above;
   EDAG proofs pinning the lowering; the shared corpus against native
   JavaScript for the string, the nullish and non-iterable sources, the
   unused name that still throws, nesting, exports and `length`.

#### Benefits and drawbacks

**Benefits.** The JavaScript convention most authored modules already use,
with JavaScript's meaning; the conversion of some hundreds of modules
unblocked; no new node, schema, interpreter or VM work; one lowering shared
by `const` and parameters.

**Drawbacks.** The outputs no longer spell what the source spelled, as with
`if`; an array pattern materializes the whole array it reads two elements
of; and two familiar spellings — rest and defaults — are refused for now, each with a message that says so and a follow-up here.

### Tasks

- [ ] Obtain and link explicit language-design approval from
      `sergey-shandar` for the syntax, the lowering and the stage boundary
      above ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
- [ ] `const` destructuring: syntax tree, grammar, binding, proofs, and the
      specification's [constants](../README.md#shared-values-constants)
      section.
- [ ] Parameter destructuring: the parameter grammar and the `length` rule,
      over the same converter and binder; the specification's
      [functions](../README.md#functions) section loses "destructuring is
      not supported yet".
- [ ] Array rest, `[a, ...r]`, as a slice of the spread array, and
      elisions, `[, b]`, the element after one taking the next index, the
      array literal's rule admitting the elision for the fold to refuse in
      a value; file the object rest and the defaults as follow-ups of
      their own.

### Related

- [Named and rest parameters](./3120-parameters.md) — the parameter list
  this extends; defaults are its follow-up and this one's.
- [Spread](../README.md#spread) and
  [property access](../README.md#property-access) — the two reads a
  pattern lowers to.
- [Statement-aware intrinsics](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)
  — the `entry` helper is recognized whole, so a pattern in its parameter
  list makes it an ordinary function, as any other departure does.
- [Shadowing](./3150-shadowing.md) — unaffected: a pattern's name is a
  name.
- [ECMAScript destructuring binding patterns](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-destructuring-binding-patterns)
  — the semantics reproduced, `RequireObjectCoercible`, `GetV` and
  `GetIterator` included.
- [MDN: Destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment).

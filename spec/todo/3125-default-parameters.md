## Default parameters

**Priority:** P2
**Status:** open — proposed, awaiting language-design approval

```js
const x = {}
const f = (a, b = x, ...r) => [a, b, r]
const g = ({ name, rows = 8 } = {}) => [name, rows]
export default [f.length, f(1)[1] === x, g()]
```

A default initializer, `= value`, on a parameter and on a name inside a
binding pattern. The semantics are JavaScript's, reached without a new
EDAG node: a defaulted position reads its value once and lowers to
`v === undefined ? value : v`, and a parameter from the first default on
is read from the rest array, which keeps the function's `length`.

### Problem

The compiler refuses `(a = 1) => a` and `{ a = 1 }`
([refused constructs](./refused-constructs.md): `decl.parameter-default`,
`decl.pattern-default`). The refusal protects nothing: a default is a
familiar JavaScript convention with a lowering to a conditional and reads
the language already performs, so keeping it out is the kind of
restriction [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
asks to justify, and nothing justifies it.

It also stands in the way of converting authored modules to `.f.js`. At
`0c9ddf8`, the authored non-proof modules under `fjs/` held 23 parameter
defaults in 14 files, and 7 defaults inside binding patterns, 4 of them in
parameters; the proofs hold at least as many again. Several read a name of
the module around them, `extraValidate = always` and
`checkReferences = ok` in [`fjs/media`](../../fjs/media/module.f.mjs)'s
`dialectEntry` and `jsonDialect`. A default parameter is the one refusal
of [`fjs/website/demo/code`](../../fjs/website/demo/code/module.f.mjs)'s
`codeBlock`, a leaf of the
[migration](../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point),
and `msg = 'assertion failed'` in
[`fjs/asserts`](../../fjs/asserts/module.f.mjs)'s `assert` is one of the
two constructs that keep every proof `proof.f.mjs`
([`fjs/compiler`](../../fjs/compiler/README.md)), the bare `if` being the
other.

### Proposal

#### Syntax

- A **parameter default**: a fixed parameter, a name or a pattern, may be
  followed by `= value`, `(a, b = 1) => …` and `({ a } = {}) => …`. A
  parameter without a default may follow one, `(a = 1, b) => …`, and the
  rest parameter may end the list, `(a = 1, ...r) => …`, but takes no
  default itself, which JavaScript does not allow either.
- A **pattern default**: a name or a nested pattern inside a binding
  pattern may be followed by `= value`, `{ a = 1 }`, `{ k: a = 1 }`,
  `[a = 1]` and `{ a: { b } = {} }`, in a `const` and in a parameter, as
  [destructuring](../README.md#destructuring) takes patterns.

`value` is any value the language reads where a `const` takes its
initializer. Everything else about a target is unchanged: a defaulted name
is a parameter or a `const` under every existing rule.

#### Semantics, by lowering

A default is sugar over a read, a strict comparison and `?:`, all in the
language already, so it adds no rule to the specification beyond the
sentence that says so:

- **The default is taken where the value is `undefined`, and only
  there**, as in JavaScript: a missing argument and an explicit
  `undefined` take it, `null` and every other value do not. A defaulted
  position lowers to a hidden `const` holding the value read, `t`, and the
  name bound to `t === undefined ? value : t`.
- **The default is evaluated only when taken, and at each call.** It is the
  arm of `?:`, which every executor evaluates only when chosen
  ([lazy operators](../README.md#operators)): `(a = null.x) => a` throws
  only when called without `a`, and `(a = {}) => a` answers a fresh object
  at each call, while `(a = x) => a` answers the one `x` it captured. The
  default is written in the arm itself and never as a hidden `const` of
  the body, which would be evaluated whether or not the arm is chosen, as
  a `const` reached only through a lazy position is.
- **`length` stops before the first parameter with a default**, as
  JavaScript's does: `((a, b = 1, c) => 0).length` is `1` and
  `((a = 1, ...r) => 0).length` is `0`. A pattern parameter with a
  default ends the count too, `(({ a } = {}) => 0).length` being `0`,
  while a default *inside* a pattern does not, `(({ a = 1 }) => 0).length`
  being `1`, the pattern one fixed parameter whatever its elements default
  to ([destructuring](./2450-destructuring.md)). So the EDAG function's
  `length` is that count, and every parameter from the first default on is
  read from the one per-call `['rest']` array
  ([named and rest parameters](./3120-parameters.md)): the `k`-th such
  parameter reads `rest[k]`, `undefined` where the caller passed fewer, and
  the source's own rest parameter, if any, binds `rest.slice(n)`, `n` being
  the number of parameters read from the rest array. A function with a
  default thus has a rest array in the EDAG it did not have in the source;
  only `length` could tell, and `length` is JavaScript's.
- **A default sees the scopes around the function and the parameters
  before it — never the body, never a later parameter.** JavaScript
  evaluates defaults in a scope of the parameters' own, between the
  function's surroundings and its body:
  - A name the default reads from outside the function is a capture, as a
    name the body reads is. The function's frame keeps it, a module
    `const` or a parameter of an enclosing call alike, and the default
    reads the same value at every call: `const h = y => (a = y) => a`.
    `const f = (a = f) => a` reads the function itself, as its body may
    ([functions](../README.md#functions)).
  - A parameter before it is read as the body would read it:
    `(a, b = a) => …`.
  - A later parameter, or the parameter itself, `(a = b, b) => …` and
    `(a = a) => …`, is refused: JavaScript throws `ReferenceError` when
    that default is taken, the name being bound but not yet initialized,
    and an outer `b` must not be read in its place, which would be a
    plausible wrong value. All parameter names are bound before any
    default is resolved, so the read finds the parameter and is refused
    at it, as a read of a later `const` is
    ([forward references](./3140-forward-references.md)). JavaScript
    accepts the read inside a function the default writes,
    `(a = () => b, b) => a()`, which reads `b` once called; it is
    refused here too, as the same read of a later `const` is.
  - A body `const` is out of the default's reach. In JavaScript,
    `const x = 1; ((a = x) => { const x = 2; return [a, x]; })()` is
    `[1, 2]`. The defaults are resolved before the body's names exist, so
    the default's `x` is a capture and the body's `x` a body entry, two
    nodes. Resolved as the body's leading entries, which is the simple
    implementation, the body's `const x` then meets the
    [existing rule](../README.md#functions) that refuses a `const` shadowing
    a name its body has already read from outside (`capture shadowed`) —
    a refusal, not another value. Admitting it needs the parameter scope
    as a scope of its own, which is a follow-up below. The default must
    never be lowered as a source rewrite into the body, where that program
    would compile to `[2, 2]`, and the planned resolution of a body read
    to a later body `const`
    ([body const forward reference](../../fjs/compiler/parser/todo/body-const-forward-reference.md))
    must not reach a default.
- **A pattern default reads once and tests once.** `{ a = 1 }` of a source
  `s` reads `s.a` into a hidden `const`, as the pattern does without a
  default, and binds `a` to the test of it; `[a = 1]` does the same with
  the spread array's element. A pattern default in a `const` sees the
  names before that `const`, and a later name of the same pattern,
  `const { a = b, b } = o;`, is refused as a parameter's is.
- **Captures are unchanged.** Every name a default reads is a capture or
  a parameter by the existing rules; the function's `['=>', length, slots,
  body]` holds them as it holds the body's.

The graph outputs write the lowered form, `(a = 5) => a` as
`(...$0)=>$0[0]===undefined?5:$0[0]` or with a hidden `const`, with fresh
names where the source's are gone — the precedent `if` and destructuring
set. The EDAG, the interpreters, the Rust writer and NaNVM see reads,
comparisons and conditionals they already answer; nothing changes below
the compiler. At `0c9ddf8` the compiler accepts these lowered spellings
written by hand and agrees with Node on them: `length`, a missing and a
`null` argument, a captured object's identity, a fresh object per call, an
enclosing call's frame, and the function itself.

#### The limit of 16

A function has at most 16 fixed parameters
([functions](../README.md#functions)). With defaults, the EDAG's `length`
counts fewer parameters than the list holds. The limit is proposed to count
every parameter before the rest, defaulted or not: it is a rule about the
list a reader sees — "wider data reads better as an array or an object" —
and the EDAG function stays well under it either way.

#### Rejected alternatives

- **The parameter kept fixed, `a => a === undefined ? 5 : a`**: `length`
  `1` where JavaScript answers `0`, a plausible wrong value that rule 2 of
  the [principles](../README.md#principles) and
  [DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
  forbid. `length` is part of the language.
- **A default in the EDAG**, a fifth element of the function node or a
  node of its own: a schema change, two interpreters, the analysis, the
  Rust writer, NaNVM and both serializers, for what the rest array and
  `?:` give exactly.
- **A source rewrite before binding**, the default moved into the body:
  it resolves the default against the body's `const`s and a later
  parameter against the outer scope, both wrong values, above.

#### Implementation shape

1. **Syntax tree.** A target gains an optional default, the `=` token kept
   for errors, in
   [`parser/syntax/types.ts`](../../fjs/compiler/parser/syntax/types.ts).
   The first parameter is read as a value, which
   [`parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs)'s
   `afterValue` explains, so the reader records `name = value` beside the
   node as it records a target, and the fold refuses it in a value, where
   it is an assignment, and reads it in a parameter list or a pattern.
2. **Grammar.** `parameterNames`' fixed target and a pattern's target take
   an optional `= value`. `=` follows a target nowhere else, so the grammar
   stays LL(1), which its proof checks.
3. **Binding.** In [`parser`](../../fjs/compiler/parser/module.f.mjs)'s
   `functionScope`, the `length` stops at the first default; each
   parameter from it on is bound to its read of `['rest']`, and the
   source's rest parameter to the slice. Every parameter name is bound
   before any default is resolved, so a read of a later one is found and
   refused. A default lowers to the hidden read and the conditional, as
   leading entries of the body; a pattern's to the same test, through the
   `planned` and `lowered` the pattern already goes through.
4. **Proofs.** Parser proofs for the syntax tree and every refusal above;
   EDAG proofs pinning the lowering; the shared corpus against native
   JavaScript for `length`, `undefined` and `null` arguments, a default that
   throws and is not taken, a fresh and a captured object, an enclosing
   call's frame, the function itself, a rest after defaults, and pattern
   defaults in `const` and parameters.

#### Benefits and drawbacks

**Benefits.** A JavaScript convention dozens of authored modules use, with
JavaScript's meaning, `length` included; `website/demo/code` converts
whole, and `assert` loses one of its two refusals; no new node, schema,
interpreter or VM work; one test shared by parameter and pattern defaults.

**Drawbacks.** The outputs no longer spell what the source spelled, as with
`if` and destructuring; a function with a default allocates a rest array at
each call, a cost not optimized before it is measured; and three valid
spellings stay refused — a default reading a later parameter or itself,
inside a function it writes too, and a body `const` shadowing a name a
default reads — each a refusal rather than another value.

### Tasks

- [ ] Language-design approval of the syntax, the lowering, the scope rules,
      the limit and the stage boundary above, recorded here with its link,
      as [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
      asks.
- [ ] Parameter defaults: syntax tree, grammar, binding, proofs, the
      specification's [functions](../README.md#functions) section, and the
      `decl.parameter-default` row of the
      [register](./refused-constructs.md) deleted.
- [ ] Pattern defaults, in `const` and parameter patterns, over the same
      test: the specification's [destructuring](../README.md#destructuring)
      section, and the `decl.pattern-default` row deleted.
- [ ] Convert `fjs/website/demo/code` to `.f.js`, and rerun the
      [leaf migration](../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point).
- [ ] File the parameter scope as a scope of its own, admitting a body
      `const` that shadows a name a default reads, as a follow-up.

### Related

- [Named and rest parameters](./3120-parameters.md) — the parameter list
  this extends, and the `length` / `arg` / `rest` contract the lowering
  reads through.
- [Destructuring](./2450-destructuring.md) — the patterns whose defaults
  this designs with the parameters', as it asks.
- [Forward references](./3140-forward-references.md) and
  [body const forward reference](../../fjs/compiler/parser/todo/body-const-forward-reference.md)
  — the refusals a later parameter and a shadowed capture meet.
- [ECMAScript `FunctionDeclarationInstantiation`](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-functiondeclarationinstantiation)
  — the separate parameter environment and the `undefined` test
  reproduced.

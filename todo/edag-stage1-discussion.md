## EDAG stage 1: discussion

**Priority:** P2
**Status:** open — working document for designing the stage 1 function
EDAG (expression DAG — see the core invariant).
Each subject below is resolved separately; once all are **decided**, the
result is distilled into [`fjs/edag/README.md`](../fjs/edag/README.md) — the
schema of record is [`fjs/edag/module.f.mjs`](../fjs/edag/module.f.mjs) — and
this document is deleted.

The concrete DJS rollout is tracked in
[`compile-modules-to-edag.md`](../fjs/fsc/todo/compile-modules-to-edag.md):
Stage 1 introduces `.` and unresolved modules; Stage 2 introduces
non-capturing `=>` and `()`, in its ordinary and method-call forms. This document owns the EDAG semantics,
not parser scheduling. Property/method-access safety is shared with
[property-accessor](../spec/todo/2330-property-accessor.md); source functions
are in the language ([functions](../spec/README.md#functions)), capturing
ones included — the frame
[function-frame](../spec/todo/3111-function-frame.md) describes, built by the
compiler and printed to Rust; VM-internal call
lowering belongs to
[call-like-instructions](../spec/todo/9100-call-like-instructions.md).

**P1 source/writer reconciliation:** the direct descriptor-value source plan
is superseded by [`entry`](../fjs/edag/todo/entry.md). That document owns the
active runtime-entry API and its writer boundary: `own` is internal, not an
alternate source spelling. The affected sections below follow that decision;
the remaining subjects retain their individual discussion status. Parsing
JavaScript syntax does not itself admit it into FunctionalScript.

**Implemented argument-model migration:** the
[named-and-rest parameter plan](../spec/todo/3120-parameters.md) owns the
implemented `['=>', length, frame, body]`, `['arg', N]` and `['rest']` contract.
Subjects 2 and 7 below follow that contract. The
remaining baseline examples and operation table using `['args']` describe
the historical zero-arity format, not the current fixed/rest target.
Current schema, compiler and executors now use fixed/rest. Do not mix the
historical invocation vocabulary with retained module-import `args`.

### Baseline: an expression DAG with anchored evaluation

*This baseline supersedes the original index-based sequence proposal; the
revision history is recorded in subjects 1 and 8.*

A function body is a **single operation node** — the root of the
expression DAG. Non-resulting computations (asserts — fail-fast
guards, A4) are merged into the graph by the **`","` operation**:

- `[",", [...asserts, result]]` establishes **all** of its operands
  (subject 8) and takes the value of the **last** one — it *is* the JS
  comma operator, `(a, b) → b`. The assert operands' values are
  discarded — they exist for their throw-potential only — and are
  unordered among themselves (A4). Result-last buys source fidelity:
  the future source pattern

  ```js
  return assert(a >= 0 && b >= 0), a + b
  ```

  lowers to a `","` node; a callable source serializer can print the
  expression back, and a JS engine running it implements one legal schedule
  (left-to-right, eager). Whether `String(f)` is that serializer is open
  (subject 12). The
  other spellings normalize to the same node — all four of

  ```js
  const f = a => { assert(a >= 0); return a + 2 }
  const g = a => { const _ = assert(a >= 0); return a + 2 }
  const h = a => { return assert(a >= 0), a + 2 }
  const k = a => (assert(a >= 0), a + 2)
  ```

  illustrate one code-EDAG shape, not one allocated function in the
  JS-compatible identity model. The last spelling — an expression-bodied
  arrow, no block, no `return` — is a compact source-rendering candidate
  (subject 12). The EDAG has **no
  assert node**: what makes an operand an assert is purely positional —
  its value is discarded by `","`. The guard itself is either an
  ordinary function value that throws on a falsy argument, or, with no
  free-variable machinery needed,
  `["?:", cond, ["undefined"], ["throw", …]]` ([Operations](#operations),
  subject 10).
  [operators](../spec/todo/2340-operators.md) allows the comma operator
  for exactly this reason: it was rejected as "useful only when we want
  to mutate", and the assert pattern is the counter-example — in a pure
  language the only side effect a discarded operand can have is
  throwing.
- The operands of a `","` are this document's **branches**: rooted
  subgraphs of the DAG, sharing nodes freely by reference — distinct
  from the control-flow branches of `"?:"` (subject 3).
- **Stage 1 ships without `","`**: a stage 1 body is a plain node, and
  the operation is introduced later, when asserts arrive, without
  changing the body's shape.

- an operation node is:
  - a **non-object, non-array value** — a constant: `"hello world"`, `2.5`,
    `false`, `null`, `34n`;
  - an **array** — a tagged tuple `[tag, ...operands]`; the tags are
    listed in [Operations](#operations) below. `["undefined"]` is one of
    these, not a bare constant — see [Operations](#operations) for why.
- **Plain objects are reserved and currently have no EDAG meaning.**
- operand positions hold **real references** to nodes, not indices.
  Referencing the same node from two positions is **semantic sharing**: the
  node is evaluated once and its result reused. `const x = ["{}"]` then
  `["[]", x, x]` yields an array with `a[0] === a[1]`, while
  `["[]", ["{}"], ["{}"]]` yields two distinct objects.
- evaluation: the root node is established (subject 8) and its value is
  the function's result; a `","` establishes all its operands, in any
  order, possibly in parallel (A4); every node is memoized by its
  identity, so shared nodes evaluate once.

The graph cannot be serialized as JSON (sharing would be lost — and
sharing is semantic), but it serializes as **DJS** (`const` + reference):
the EDAG's sharing structure and DJS's graph structure are the same thing.

```js
// const f = (...a) => { const x = a[0]; return [x, x] }
const x = [".", ["args"], 0]
export default ["[]", x, x]          // the body is one node; x is interior

// (...a) => { const check = a[0].length; return a[1] } — with comma (later)
const a = ["args"]
export default [",",
    [".", [".", a, 0], "length"],  // assert: value unused
    [".", a, 1],              // the result: last, as in JS (a, b) → b
]
```

#### The core invariant

**An EDAG validated for a declared execution profile must obey that profile's
semantics.** The baseline below uses the
[JS-compatible identity model](../fjs/edag/execution-models.md#2-js-compatible-execution)
and the [language principles](../spec/README.md#principles), including their
explicit failure and function-text exceptions. Other identity models are
separate contracts, not alternative implementations of this baseline.

**EDAG** — *expression DAG* — is the name for what this document
builds. Both halves are load-bearing:

- **expression**: the graph has no statement nodes at all. `const` is
  sharing, `if` is `"?:"`, `return` is the root node, an assert is a
  `","` operand ([Operations](#operations)). Every node is an
  expression;
- **DAG**: sharing and acyclicity are both *semantic*, so "tree" was
  never right.

The term comes from *Compilers: Principles, Techniques, and Tools*
(Aho, Sethi & Ullman; 2nd ed. with Lam), where a DAG for an expression
is a syntax tree whose common subexpressions are shared, and DAGs
represent basic blocks for local optimization. **FunctionalScript
inverts its status.** There a DAG is *derived* from a tree by common
subexpression elimination, and the two denote the same computation
because sharing is unobservable — an optimization. Here the EDAG is
**primary**: sharing is observable (`["[]", x, x]` and
`["[]", ["{}"], ["{}"]]` are different functions, subject 1), so no
tree denotes what an EDAG denotes, and the sharing is authored rather
than recovered by analysis.

Related representations, for orientation: *term graphs* in the
term-rewriting literature are the same structure (though often
permitting cycles, which validation here forbids); the **VSDG** (value
state dependence graph) is the closest compiler IR, since its state
edges play the role of our `","` operands; *sea of nodes* is the same
family but carries control edges and a scheduling phase this design
does not have.

*AST* is reserved for **grammar parser output** ([fjs/ebnf](../fjs/ebnf/README.md),
[fjs/fsc](../fjs/fsc/README.md)). The source AST represents a subset of
JavaScript syntax, including statements, not an already-valid FJS program.
[AST-to-EDAG compilation](../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
resolves bindings and const visibility, checks early errors, matches complete
instruction patterns and enforces FJS restrictions before producing EDAG.
The function representation is the EDAG, not that source tree.

"Behaves the same" means, precisely, under the assumptions:

- the same successful observations under the declared identity model (A1).
  JS-compatible execution preserves JavaScript allocation and sharing;
  being non-CA grants no exemption. The separately adopted
  [function-text exception](../spec/README.md#function-source-representation-exception)
  covers EDAG-derived text and its consequences, not arbitrary identity changes;
- required failures are preserved (A3), subject to the explicit semantic
  exceptions; a runner may also interrupt at its own resource limits (A2);
- order of evaluation and the identity of an error are **not** part of
  behavior (A4).

Two consequences worth stating plainly:

- **Validation is a total gate.** The invariant binds *every* validated
  graph, not just compiler output — the `Function` constructor accepts
  an `Any` from anywhere, so "the FJS compiler would never emit that" is
  never an admissible argument. This is why the property-key rule is
  syntactic ([Operations](#operations)) rather than a convention:
  anything a hostile graph could express, validation must have already
  ruled out.
- **Printed source must preserve the semantics.** Within the source writer's
  supported domain (subject 12), a JS engine running the printed source and
  the VM must agree under the declared compatibility profile. Schema validity
  alone does not promise a source spelling for every internal operation:
  internal-only `own` is refused by the writer under the `entry` plan.
  For compiled source, compare the original source as well as the output;
  print-run agreement alone does not prove the original lowering correct.

Agreed points (not under discussion):

- Host-value reuse follows [DESIGN.md §8](../doc/DESIGN.md): constants describe
  themselves; tags only where the host value is ambiguous. `["[]", ...]`
  is a complete escape hatch — any constant array is expressible.
- A call that keeps its `this` binding is semantically required, not an
  optimization:
  [property-accessor](../spec/todo/2330-property-accessor.md) shows
  `a.indexOf(x)` and `const p = a.indexOf; p(x)` differ observably. It is
  spelled by the property-access node owning its call (subject 6), not by a
  distinct `".()"` tag.
- `args` is **a single operand that evaluates to an array**, not a
  literal list of operand nodes: `f(a, b)` is
  `["()", f, ["[]", a, b]]`, while spread `f(...xs)` is just
  `["()", f, xs]` and forwarding is `["()", f, ["args"]]` — free,
  because `["args"]` is itself a first-class array (subject 2). A
  literal-list operand would save the `["[]", …]` wrapper in the
  common case but would need a spread marker for those. Same for every
  other argument operand: `"?.()"`'s and the call steps' (subject 6).

### Operations

The operations we want, with their stage. Every operand is an operation
node; `node` below means any of them. The stage numbers match the concrete
DJS rollout in
[`compile-modules-to-edag.md`](../fjs/fsc/todo/compile-modules-to-edag.md).

#### Structural operations

**"Stage" names which compiler/interpreter task is scoped to emit or consume an
operation — not when the EDAG schema itself admits it.** The schema
(`fjs/edag/module.f.mjs`) doesn't have to wait for a task before defining a shape, and
in practice it doesn't: `"own"`, `"Number"`, `"String"`, and `","` are marked `later`
below, `"=>"` was marked a not-yet-implemented Stage 2, and `["frame"]` was marked
`later` too (further down, under [Operations](#operations)) — yet all were already
validated by `exp`, before any compiler emitted them. The optional nodes are the sharpest case: `"?."` and `"?.()"` are in the
schema even though `?.` is not an FS source operator in its own right (see below), because
the `Function` constructor takes EDAG from anywhere and a chain's hidden control flow has
to be representable and validatable when it does. A node being schema-valid says nothing about whether any parser emits it or
any interpreter executes it — that's what the `Stage`/`later` marker tracks, and the
schema is free to change independently of both.

|Form|JS|Stage|Notes|
|----|--|-----|-----|
|`2.5`, `"a"`, `true`, `null`, `34n`|itself|1|constant — any non-object, non-array value|
|`["undefined"]`|`undefined`|1|the value `undefined`, as its own node — a bare `undefined` would be indistinguishable from a missing tuple position (a position past a node's arity reads as `undefined` too), so it is not a bare constant like the row above|
|`["[]", [...node]]`|`[…]`|1|array constructor; the elements are one operand, an array of nodes — not spread across the tuple|
|`["{}", [...entry]]`|`{ … }`|1|ordered object constructor; the entries are one operand, an array — initial entry form is `[":", key, value]` (subject 4)|
|`["args"]`|—|1|the arguments array (subject 2)|
|`[".", object, property]`, `[".", object, property, k]`|`o.p`, `o[p]`, `o.p(...args)`|1|property access, owning whatever its receiver is used for; a plain read leaves `k` out and is the shorter tuple; `property` is restricted (see below)|
|`["()", callee, args]`|`f(...args)`|2|call with no receiver; `args` is one node yielding an array (subject 6)|
|`["?.", object, property]`, `["?.", object, property, k]`|`o?.p`, and the rest of its optional region|later|optional property access; same `property` restriction|
|`["?.()", callee, args]`, `["?.()", callee, args, k]`|`f?.(...args)`, and the rest of its optional region|later|optional call|
|`["\|()", args]`, `["\|()", args, k]`|one chain step, `(...args)`|2|not an `exp` node — only valid as the continuation `k` of a chain node or another step (subject 6); this is the step a method call's `.` node carries, so Stage 2 needs it|
|`["\|.", property, k?]`, `["\|?.()", args, k?]`, `["\|!()", args]`|one chain step|later|the remaining steps: a property access inside an optional region, a guarded call, and the call a group puts outside the region|
|`["own", object, key]`|— internal only|later|no standalone source spelling; runtime-entry API and semantic migration belong to [entry](../fjs/edag/todo/entry.md)|
|`["Number", node]`|`Number(x)`|later|numeric coercion that accepts bigints, unlike unary `+`|
|`["String", node]`|`String(x)`|later|string coercion|
|`[",", [...node, node]]`|`(a, b)`|later|membership without order (subject 8); the operands are one operand, an array, as for `"[]"`|
|`["=>", length, frame, body]`|`(…) => …`|2|function; `length` is integer metadata (subject 7); `frame` is a general `exp` in the schema — Stage 2's own compiler/interpreter scope was narrower and only emitted/accepted a placeholder for it; the compiler now emits an array of captured values, `null` where there is none ([functions](../spec/README.md#functions))|

`["{}", [...entry]]` is an ordered object-construction operation. Stage 1
uses `[":", key, value]` entries.

Both structural constructors take their variadic part as **one operand
holding an array**, rather than spreading it across the tuple — the shape
[`../fjs/edag/README.md`](../fjs/edag/README.md) writes as `['[]', items[]]`,
and where "Why an array operand rather than a variadic tail" gives the
reason. The entry list preserves the source
property sequence. The key position is a node, and validation admits any
node there — a computed key like `{ ["sss" + 3]: x }` is valid JS and a
validly-shaped EDAG, even though today's compiler only lowers the trivial
computed-key form; see subject 4 for why validation does not narrow this to
a string constant. Entry forms are local to the object
constructor rather than general expressions. Later, new entry forms can be
added without changing the outer operation; for example `["...", object]`
can represent `{ ...object }`. Plain objects remain reserved and have no EDAG
meaning yet.

Tags are **JS syntax wherever JS has syntax for the operation** — hence
`"."`, `"()"`, `"?."`, `"?.()"`, `"{}"`, `":"` and `","` above, and the
operator symbols below. This is [DESIGN.md §8](../doc/DESIGN.md) again: the host
language already spells these, so the EDAG reuses the spelling instead of
inventing a vocabulary to be memorized and translated. A chain step is the
same spelling behind a `"|"`, which marks it as a step rather than a node —
and the prefix is load-bearing, not decorative: without it `["()", f, k]`
would read equally as a call node and as a chain step. `"|."` is the `.b` of
a chain, `"|?.()"` its `?.(…)`, and `"|!()"` the call a group puts outside an
optional region.

**The property operand is restricted**, in `"."`, `"?."`, and `"|."`
alike. It
must be one of:

- a **string constant** that is not on the prohibited list
  ([property-accessor](../spec/todo/2330-property-accessor.md):
  `constructor`, `__proto__`, the instance methods, …);
- a **number constant**;
- a `"Number"` node — guaranteed to yield a number, or throw.

So a run-time-computed **string** can never reach `"."`. This is a
*syntactic* rule, checkable when the `Function` constructor validates
its input (subject 5), which is what 2330 already asks of the byte code:
the expression inside `[]` must be `Number(...)`, a number literal, or a
permitted string literal.

The point is that the dangerous case becomes **unrepresentable rather
than checked**: prototype-chain lookup by a computed name — the abuse
2330 documents (`f.constructor("…")`, `__proto__`) — has no spelling in
the EDAG at all.

The EDAG spells unary `+` as `["+", node]` — JS's own, which does the same
coercion job as `Number(x)` for every type except **bigint**, where it throws
instead of converting. FunctionalScript does not parse it: `["Number", node]`
is the language's one numeric-coercion form, spelled by its JS built-in, and
which EDAG operations the language admits as syntax is
[operators](../spec/todo/2340-operators.md)'s decision, not the EDAG's. The
EDAG admits an operation when it is pure — its result a function of its
operands and nothing else — and unary `+` is.

**Superseded source plan:** the former direct lowering of
`Object.getOwnPropertyDescriptor(object, key)?.value` to `["own", object, key]`
is not an admitted standalone FJS instruction. It would expose non-enumerable
properties as well as data entries. The JavaScript-subset AST may represent
that expression; the AST-to-EDAG compiler, not a parser-specific ban, rejects
its standalone use or a descriptor escaping an approved pattern.

The active proposal is [`entry`](../fjs/edag/todo/entry.md): recognize the
complete parsed enumerable-entry helper, lower its function definition to
`['entry']`, and use ordinary calls. `own` remains the internal operation;
the source writer refuses a bare `own` node rather than printing the retired
descriptor-value expression. The entry proposal owns receiver/key conversion,
function observations and the coordinated migration of internal semantics.
This discussion does not silently change the existing opcode implementation.
All instruction patterns follow the
[JavaScript AST → checked EDAG compilation boundary](../fjs/fsc/parser/todo/statement-aware-intrinsics.md).

`"=>"` is the function constructor because FS has only **arrow
functions** — there is exactly one spelling to reuse, so the tag is
unambiguous. A named function expression was suggested as a source
representation of `["self"]`; it remains a candidate, not a selected spelling
or a newly admitted function form (subject 12).

Word tags remain only where no unambiguous JS spelling exists:

- `"args"` — FS has no `arguments` object to borrow a spelling from
  (subject 2);
- `"frame"`, `"self"` — JS has no expression for either (`arguments`
  is not FS's model, and `arguments.callee` is forbidden in strict
  mode);
- `"throw"` — a JS keyword, but a *statement*, so there is no
  expression spelling to reuse;
- `"own"` — internal operation, without an independent FJS source spelling.

`"Number"` is not an exception: it is spelled exactly as the JS built-in
it denotes.

Symbol tags never collide with word tags, so both live in one namespace.

#### Operators

**`+` and `-` are one tag each at two arities.** `["-", a]` is negation
and `["-", a, b]` subtraction — the same overloading JS itself uses for
its own `-` — and `["+", a]` is unary plus beside `["+", a, b]`. An
earlier draft spelled negation `"neg"` instead, because rtti tuples had
open trailing positions then: a tag shared between two `exp` alternatives
at different arities made the `or`'s alternative order load-bearing, the
one-operand form also matching a two-operand value unless checked after
it. Tuples are closed now and validated by length, the chain steps already
end by the same arity rule, and `fjs/edag` groups the two tags as
`op12`, a vocabulary disjoint from `op1`/`op2` so those two still fix an
arity by membership alone.

|Symbols|Arity|JS|Lazy|Notes|
|-------|-----|--|----|-----|
|`+` `-`|1|`+a`, `-a`|no|unary plus and negation — the arithmetic tags below at one operand (see above); unary `+` is not FunctionalScript syntax ([operators](../spec/todo/2340-operators.md)), and [property-accessor](../spec/todo/2330-property-accessor.md)'s run-time-index coercion is `"Number"`, not an operator|
|`!` `~`|1|`!a`, `~a`|no|unary only|
|`typeof`|1|`typeof a`|no|the type tag of a value, a fresh string; an EDAG operation that is not FunctionalScript syntax ([operators](../spec/todo/2340-operators.md))|
|`+` `-` `*` `/` `%` `**`|2|`a + b`|no|arithmetic|
|`===` `!==` `<` `<=` `>` `>=`|2|`a === b`|no|`==` and `!=` are not allowed by [operators](../spec/todo/2340-operators.md)|
|`&` `\|` `^` `<<` `>>` `>>>`|2|`a & b`|no|bitwise|
|`&&` `\|\|` `??`|2|`a && b`|**yes**|the right operand is established only if the left does not decide the result|
|`?:`|3|`c ? t : e`|**yes**|exactly one of the two arms is established|

All operators are post-stage-1: stage 1 has no operators at all.

#### Other operations

|Form|JS|Stage|Notes|
|----|--|-----|-----|
|`["throw", node]`|`throw v`|later|always fails; never produces a value|
|`["self"]`|—|later|the function itself; recursion is `["()", ["self"], args]`|
|`["frame"]`|—|captures|the captured-consts frame, an array — as `["args"]` is for arguments; emitted by the compiler task that made captures a frame slot, which read it as `[".", ["frame"], i]`|

**`["frame"]` and the closed-scope model.** A closure's free values are
copied into a frame when the function object is created — the scheme
[function-frame](../spec/todo/3111-function-frame.md) chooses — and
`["frame"]` is that array. It needs no accessor of its own: a slot is
ordinary indexing, `[".", ["frame"], i]`, exactly as an argument is
`[".", ["args"], 0]` (subject 2).

Frame construction mirrors a call: `["=>", frame, body]`, where
`frame` is one node evaluating to an array — built in the *enclosing*
scope, usually `["[]", …]` — and `body` is the inner function's
graph. Compare `["()", f, args]`: same shape, one for entering a call,
one for creating a closure.

```js
// const f = x => { … const b = y => { … f(y) … }; … b(…) … }
// inside f, building b — f puts its own ["self"] into b's frame:
["=>", ["[]", ["self"]], /* b's body */ …]
// inside b, calling f — slot 0 of b's frame:
["()", [".", ["frame"], 0], ["[]", [".", ["args"], 0]]]
```

Consequences:

- **A function body is a closed graph.** Its only leaves are constants,
  `["args"]`, `["frame"]` and `["self"]` — every other value is
  computed from them. Nothing refers outward.
- That **resolves the nesting corner** flagged in subjects 3 and 9: a
  node cannot be shared across a function boundary, because the inner
  body's leaves mean something different there. It is not a rule to
  enforce so much as a consequence of the model — and it is what makes
  each function independently hashable.
- **`["self"]` is still primitive**, not just a frame slot: a
  top-level recursive function has no enclosing scope to build its
  frame, so something must break that cycle. `["self"]` breaks it, and
  frames propagate it inward (as in the example above).

`["self"]` is what makes recursion expressible in a nameless EDAG, and —
more importantly — what keeps a recursive function **finite and
acyclic**. Without it, self-reference would have to be a cycle in the
graph: forbidden by subject 5, and unhashable, since a cyclic structure
has no structural hash without a fixpoint. With `["self"]` a recursive
function is an ordinary DAG, so content addressing (subject 9) works for
recursion with no special machinery.

- **Mutual recursion is not covered.** `["self"]` reaches only the
  innermost enclosing function; `a` calling `b` calling `a`
  ([function-frame](../spec/todo/3111-function-frame.md) has exactly this example)
  is a cycle *between* functions. Either the partner is passed as an
  argument, or mutually recursive functions form a hashed **group** with
  members addressed by index. Open, and it belongs with subject 9 —
  it is the same "hash a cycle" problem `["self"]` solves for the direct
  case.
- **Binds to the innermost enclosing function**, exactly like
  `["args"]` — so once `["=>", …]` nests, a node using `["self"]`
  cannot be shared across nesting depths. That is the closed-scope
  model, not a defect: it is what makes each function body hash
  independently (subjects 3 and 9).
- **Word tag**: JS has no expression spelling for "this function"
  (`arguments.callee` is forbidden in strict mode). A named function
  expression — `function self(…) { … self(…) … }` — is a candidate for
  callable source serialization, subject to syntax admission and the open
  `self` question (subject 12); no `String(f)` strategy is selected.
- **Useless before `"?:"`**: with no branch there is no base case, so
  every `["self"]` call diverges. It lands with the operators, and
  before [let](../spec/todo/3220-let.md) (subject 11) — recursion is the
  baseline that `let` exists to make cheap on engines without TCO.

`throw` keeps a word tag because JS spells it as a **statement**, not an
expression — there is no operator symbol to reuse. Consequences:

- **Assertions become expressible in the EDAG**:
  `["?:", cond, ["undefined"], ["throw", …]]`. This matters more than
  convenience — the EDAG has no way to *reference* a free variable
  (module `const`, import, built-in): `["args"]` and constants are its
  only leaves (see subject 10). A host `assert` function would need that
  machinery; an operation does not.
- **`["throw", v]` always fails**, so it is the one node that is
  *provably throwing* — the mirror of the "provably non-throwing"
  predicate. It must never be speculated into a position JS would not
  reach.
- **The thrown value is not observable to FS code** (A4: errors carry no
  information; no catch). So whether `v` is evaluated at all is
  unobservable — the operation fails either way, including when
  evaluating `v` would itself throw. Engines *should* evaluate it for
  out-of-band diagnostics, and a test framework may reveal it
  (subject 8), but nothing in FS semantics depends on it.
- **Callable-source wrinkle**: since `throw` is a statement, a `throw`
  node inside an expression has no direct JS spelling. A wrapper such as
  `(() => { throw v })()` is a candidate, subject to FJS admission and
  round-trip support. Alternatives (a recognized `throw` helper, or an
  expression-level `throw` pattern) remain to settle with assertion syntax.
  This does not decide the `String(f)` contract (subject 12).

**Laziness is positional, not nodal.** A lazy operand is a node that may
never be demanded — but the same node referenced from an eager position
elsewhere is still evaluated there, once, by memoization. Short-circuit
operators are therefore the one exception to subject 8's "all operands
are established": for `&&`, `||`, `??`, `?:` the operand set is
*conditional*, exactly as in JS — which is what keeps A3 exact, since JS
does not evaluate those operands either.

**`?:` is the branch node — there is no `if` operation.** The
hypothetical `["cond", …]` of subject 3 is not needed: the ternary
operator is that node, spelled as JS spells it. If the *language* gains
`if`, it is surface syntax that lowers to `"?:"`; the EDAG never grows a
statement form for it.

This generalizes: **the EDAG has no statement nodes at all.** Every
statement form in the source language lowers to an expression
operation — `const x = …` to a shared node, an unused `const` or a bare
`assert(…)` to a `","` operand, `return e` to the root node, `if` to
`"?:"`. The expression graph is the whole language; statements are
surface syntax over it. [let](../spec/todo/3220-let.md) and loops are
the pressure point on this — see subject 11.

The cost lands on the compiler: lowering `if` must be **deterministic**,
because hash-as-written (subject 1) makes two spellings two functions.
`if (!ok) throw e; return v` can lower to either

```js
["?:", ok, v, ["throw", e]]           // branch on the result
[",", ["?:", ok, ["undefined"], ["throw", e]], v]   // guard, then result
```

— the same function, different hashes. Which lowering is canonical is
to settle when `if` is specified; the general case (an `if` in the
middle of a body, early returns) needs a specified normalization, not
just an example.

**Throwing is the only effect.** In a purely functional language (A1)
the sole side effect an eager computation can have is *throwing* — with
non-termination and resource exhaustion collapsed into the same opaque
failure (A2, A4). Everything else about a node is just its value.
Consequences:

- the whole membership apparatus — `","`, subject 8, effect edges —
  exists for this one effect. Were nothing able to throw, the EDAG would
  be pure data flow: unreachable nodes could simply be dropped;
- eager and lazy evaluation of an operand differ *only* in whether a
  failure can be introduced. So the ban on **speculating** a lazy
  operand (A4) is narrower than stated there: an operand **proven
  non-throwing may be speculated**, hoisted, or evaluated in parallel —
  the same as-if reasoning that lets a proof stand in for running a
  guard (subject 8);
- "may throw" is therefore the single predicate an optimizer needs.
  Nodes proven total are freely movable and droppable — but **not
  freely duplicable**: an object or array constructor creates observable
  identity even though it cannot throw (subject 1).

### Assumptions

Different graph-building rules follow from which of these assumptions are
accepted or rejected. Enumerated first, analyzed separately; each ends as
**accepted** or **rejected**, and the graph-building rules in the subjects
are then derived from the accepted set.

#### A1. No side effects

**Status:** accepted

Code and functions have no side effects (FS principle 1,
[spec/README.md](../spec/README.md)). Successful observations follow the
declared identity and function-text contracts. In the JS-compatible identity
model, repeated calls may create distinct objects or functions; determinism
is not a requirement to return the same allocated object across calls.

#### A2. The runner may interrupt

**Status:** accepted

A runner has the right to interrupt a function if it consumes too many
resources or takes too much time to compute. No specific memory or time
limits are part of the specification.

Resource limits are a property of the **engine**, not of the function.
Where one executor interrupts, another may complete. A2 permits different
resource limits and interruption points, not different successful results
under the same semantic contract. An interruption is the same opaque failure
as any other under [the failure rule](../spec/README.md#failure-is-one-outcome);
a stopped run must not invent a successful value or be cached as proof of a
semantics-mandated failure.

#### Identity and function-text contracts

**P1 reconciliation:** the former A2 tiered guarantee is superseded. It
incorrectly permitted unspecified identity differences for all non-CA engines.
Resource freedom and successful-result semantics are separate concerns.

[Execution models](../fjs/edag/execution-models.md) owns the distinctions:
JS-compatible execution preserves allocation identity and sharing, including
across calls; global memoization has its stated cross-invocation reuse;
CAVM uses content identity; Amnesia deliberately does not implement shared-node
identity semantics. The last three are not interchangeable JS-compatible
implementations. Differences in `===`, `!==` or identity-dependent results
must follow the selected model, not an unenumerated "non-CA" exception.

Within a specified model and version of its identity/rendering contract,
executors must agree on successful observations. In particular, CAVMs using
the same content-identity and serialization version must agree; that requirement
does not weaken JS-compatible executors' allocation and sharing guarantees.
The [function-text exception](../spec/README.md#function-source-representation-exception)
is independent of identity: FJS VMs use EDAG-derived default text, while direct
JavaScript execution retains its host representation. The
[rendering questions](../spec/todo/serialization.md#function-text-and-serialization)
remain open; neither A2 nor this identity clarification decides them.

#### A3. Throws are preserved

**Status:** accepted

Outside the specified semantic exceptions and their consequences, if a
function **always** throws in JavaScript for the same parameters, it must
also **always** fail in JS-compatible execution with those parameters.
Required failure is preserved; its payload and first failing operation are not.

"Always" scopes both sides to determinism-by-semantics: covered are the
throws the language mandates (e.g. `null[0]` fails on every run);
excluded are engine-dependent failures (stack-overflow depth,
out-of-memory), which ECMAScript does not pin down — those fall under
A2's interrupt freedom instead. Together with FS principle 2: when JS
always completes with a value, an uninterrupted FS run completes with
that value — so for spec-deterministic behavior, FS fails iff JS throws
or the runner interrupts (A2).

#### A4. Computation order is preserved

**Status:** rejected — replaced by the opaque-error contract

Preserving observable computation order would forbid rearranging the
graph (for canonical hashing) and most optimization. Rejection is sound
only given A1 and only under the following contract.

**Opaque-error contract.** For every input, a function's observable
outcome is either the value required by its declared semantic contract or
one indistinguishable "unexpected error":

- an error carries no information out of a function — no error values,
  types, or messages cross the function boundary (`throw password`
  cannot leak; errors are not an exfiltration channel). Example of why,
  interlocking with unordered branches:

  ```js
  const f = user => {
      assert(authorizedUser(user))
      // ... deep in the data path:
      throw `invalid-api-key: ${apiKey}`
  }
  ```

  With branches unordered, an engine may evaluate the data path before
  the authorization guard — a race that would hand an unauthorized
  caller the API key if throw payloads were observable. Opaque errors
  make the race harmless: whichever throw fires first, the caller sees
  the same information-free failure. Opaque errors are not only what
  *permits* rejecting A4 — they are what makes unordered guards *safe*
  in the presence of secret-carrying throws;
- FS code cannot catch or inspect errors — stage 1 has no catch, and
  failures propagate to the host. A future catch/Result facility
  observes failure only at region granularity, and reordering must then
  respect region boundaries;
- a runner interrupt (A2) is observably the same "unexpected error":
  aborts, JS-mandated throws, and non-termination all collapse into one
  failure outcome;
- runners may emit out-of-band diagnostics (which operation failed, and
  where) for humans; FS code can never read them.

Soundness: by A1 the completed value is order-independent; by A3 plus
anchoring (subject 8) every may-throw operation still evaluates under
any reordering, so fails-vs-completes is order-independent; reordering a
throw behind a non-terminating computation yields failure either way
(A2). Hence all evaluation orders of independent anchored branches are
observably equal.

Unlocked by rejecting A4:

- reordering and parallel evaluation of independent anchored branches;
  canonical ordering for hash matching (subject 1 note);
- **fail-fast guards**: an anchored branch whose value the result never
  uses (an assert, a range check) is pure throw-potential — an engine
  may execute such branches as soon as possible, e.g. hoisted into a
  prologue before expensive data-path work, or in parallel with it.
  Failing early also wastes fewer resources (A2), and an AOT backend can
  compile the guards into a literal precondition prologue;
- **resource-aware orchestration**: branches are schedulable units, so a
  smart orchestrator may put a branch on hold when it demands too many
  resources (e.g. allocates heavily) — a hold is unobservable since no
  order is. Combined with fail-fast, the orchestrator parks the
  expensive branch, races the cheap asserts, and either saves the parked
  work (an assert fails) or resumes it (all pass) — making interruption
  (A2) the last resort rather than the only tool.

Still illegal with A4 rejected:

- **dropping** an anchored may-throw operation — A3 makes the `","`
  merge an existence guarantee (subject 8);
- **speculating** a lazy operand — a not-taken branch may throw where JS
  completes; unless it is *proven* non-throwing, in which case
  speculation is unobservable and allowed (see "Throwing is the only
  effect" in [Operations](#operations));
- **merging** identical constructor nodes — object identity is
  observable and sharing stays semantic (subject 1).

### Subjects

#### 1. Structure: indices vs. nesting vs. references

**Status:** decided (revised)

**Resolution: the EDAG is a DAG of operation nodes connected by real
references; there is no index space and no normal form — the EDAG mirrors
the source structure and the hash takes it as written.**

History: this subject was first decided as "flat sequence with
`["local", index]` references plus nesting, mirroring the source". The
reference model replaces the index space entirely — the host language
already has references, so the EDAG should not invent an index scheme on
top of them ([DESIGN.md §8](../doc/DESIGN.md) taken to its logical end). The
`["local", i]` command is removed.

Kept from the original decision, unchanged:

- **The EDAG mirrors the source; no normalization.** A source subexpression
  is an anonymous nested operand; a source `const` is a shared interior
  node that other nodes reference — or an assert-branch root when its
  value is unused. Sharing cannot be inlined away (it is
  observable: `{} === {}` is `false`), and reordering is constrained by
  throw order (subject 8) — so neither "maximally flat" nor "maximally
  nested" is a valid normal form. Hash identity = structural identity of
  the graph as written (the name-erased source); hash equality does not
  decide semantic equivalence (same stance as Unison).
  *Note (A4 rejected):* the throw-order half of this rationale is
  superseded — under the opaque-error contract, canonical reordering and
  inlining are *sound* modulo sharing, so a normal form is now possible
  in principle. Whether to adopt one is parked with subject 9 (its
  motivation is hash matching); stage 1 keeps hash-as-written.
- **Lowering is one-way and lossy.** Lifetime and slot management — `pop`,
  top-relative indexing, auto-consuming RPN stack schemes — belong to the
  VM-internal bytecode
  ([vm-command-format](../spec/todo/vm-command-format.md),
  [call-like-instructions](../spec/todo/9100-call-like-instructions.md),
  [function-frame](../spec/todo/3111-function-frame.md)), whose generator
  does liveness analysis. Restoring the EDAG from bytecode is neither
  required nor generally possible: the function always carries its EDAG.
- **The EDAG feeds multiple processors**: the bytecode interpreter,
  source rendering and callable serialization (their relationship is open in
  subject 12), and AOT backends
  (Rust, potentially WASM or machine code). Its structure is preserved
  because those backends exploit it; the interpreter may realize scopes as
  dynamic frames and pass whole frames to closures, while a bytecode
  backend may compute capture sets and copy — both derivable from the EDAG,
  neither expressible in it.
- Cost accepted: a tree-walking interpreter recurses on operand depth; a
  hostile EDAG can threaten the native stack. Answer: a documented
  implementation limit and/or internal lowering to a stack form — the
  interpreter's concern, not the format's.

Indices reappear only as **derived artifacts**: canonical serialization
(subject 9) and bytecode both derive them from the graph; they are never
authored and never part of the EDAG.

#### 2. Arguments reference

**Status:** fixed/rest bindings implemented in #2237, following
[named and rest parameters](../spec/todo/3120-parameters.md). The remaining
migration and default-text work is tracked there.

**Historical format:** `['=>', frame, body]` had length zero, and its
function-owned `['args']` yielded the complete supplied argument array.
That invocation contract is superseded; the examples elsewhere in this
document using it remain historical.

**Current format:** `['=>', length, frame, body]` records canonical nonnegative
integer `length` metadata and exposes two invocation bindings. Length and
index zero must be positive zero; `-0` metadata is refused.

- `['arg', N]` reads fixed position `N`, where `N` is a constant integer
  and `0 <= N < length`. A missing fixed argument reads as `undefined`.
  Validate the index against the owning function, not an enclosing or nested
  function's length. Parameter names are erased after binding validation.
- `['rest']` reads the supplied tail beginning at `length`, including any
  explicitly supplied `undefined` in that tail. It is one array binding per
  invocation, not a new slice on each read. Repeated reads share it; distinct
  invocations have distinct rest arrays in the JS-compatible profile.

Function invocation scopes have no complete-list `['args']`. Unresolved
modules retain their separate ordered import binding under that tag.
Omission versus explicit
`undefined` within the fixed prefix is intentionally unobservable; at length
zero, rest is the complete supplied list. Fixed values and rest captured by
another function use the existing frame mechanism.

The earlier rejection of `['arg', i]` concerned a design with no rest array.
It does not apply to this pair: `['rest']` supplies the reified tail and can
be forwarded through the ordinary array-valued call operand. Rebuilding the
fixed prefix plus rest yields normalized arguments, not a promise to recover
the original number of supplied fixed arguments.

Implemented lowering examples (names erased):

```js
const f = (...a) => a[5];          // length 0; body ['.', ['rest'], 5]
const g = a => a[5];               // length 1; body ['.', ['arg', 0], 5]
const h = (a, b, ...tail) => tail; // length 2; body ['rest']
```

For old zero-arity nodes, migrate function-owned `['args']` to `['rest']`
in its owning scope while preserving module-import `['args']`. A function's
frame belongs to the enclosing scope; only its body opens a new invocation.
Positive-arity/full-arguments sketches are a different, stronger
contract and have no general lossless conversion. They remain only in the
[complete-arguments alternative](../spec/todo/arity-complete-arguments.md),
not as an implementation prerequisite for the fixed/rest contract.

#### 3. Lazy operators and the branch extension path

**Status:** decided (for what stage 1 must guarantee)

`?:`, `&&`, `||`, `??` ([operators](../spec/todo/2340-operators.md)) are
lazy, and operations throw — so eager evaluation of both sides is
observably wrong. Stage 1 ships no branches; it must only keep the door
open:

- **Operand shapes are specified per command** (`"."` takes two
  operation nodes), never by a global rule like "an array in operand position is
  always a tagged operation" — so future commands with differently-shaped
  operands are additions, not breaking changes.
- Recorded extension path: the lazy operators themselves —
  `["&&", a, b]`, `["||", a, b]`, `["??", a, b]`, `["?:", c, t, e]` (see
  [Operations](#operations)) — where laziness is a property of the
  operand *position*. No separate `cond` node is needed: `?:` is the
  branch node. A branch operand is an ordinary node — including a
  `","` node when the branch has its own guards, which gives each
  control branch its per-branch effect membership with no extra
  machinery (subject 8).
- The reference model dissolves the scoping problem that the index model
  had: there is no index space to scope, no De Bruijn `(up, index)`
  machinery; sharing across a lazy boundary is a plain reference, and a
  node demanded from two branches evaluates at most once (memoization).
- Resolved by the closed-scope model ([Operations](#operations)): a
  nested function's body is a closed graph whose leaves — `["args"]`,
  `["frame"]`, `["self"]` — are its own, so a node simply cannot be
  shared across a function boundary, and "whose arguments?" never
  arises.

#### 4. Object constructor: ordered entries

**Status:** decided (revised)

**Resolution: an object constructor is `["{}", [...entries]]`, and the
entry sequence is semantic.** Stage 1 uses one entry form,
`[":", key, value]`. Both the key and value positions are ordinary EDAG
nodes — `{ ["sss" + 3]: x }` is valid JS, the key is a computed expression
coerced via `ToPropertyKey` at runtime, and validation admits it: an `Any`
handed to the `Function` constructor can contain any key node, and "the FJS
compiler would never emit that" is not an admissible reason to narrow what
validation accepts (subject 1). Entry forms belong to the object constructor
rather than to the general expression vocabulary.

*Revised: the entries are one operand, an array, not spread across the
tuple* — the schema cannot express the flat spelling and the nested form is
what shipped; see the note under the structural-operations table.

*Revised: validation does not restrict the key to a string constant.* An
earlier draft of this resolution stated "current validation nevertheless
accepts only string-constant keys" — dropped for the same reason subject 1
gives above: today's DJS compiler happening to emit only trivial computed-key
forms (`{ ["sss"]: x }`, not yet `{ ["sss" + 3]: x }`) describes the
compiler's current lowering, not a bound on what a validly-shaped EDAG value
is. The two are independent: the compiler can under-produce (emit only a
subset of what validation accepts, expanding its lowering over time without
ever needing validation to change) but validation must not under-accept
relative to the value model, or it rejects `Any` values that are
perfectly well-formed EDAGs.

History: this subject previously represented an object constructor as a
plain EDAG object and rejected duplicate keys during validation. The revised
representation uses the tagged `["{}", [...entries]]` operation, reserves plain
objects for future use, and keeps duplicate entries so construction can follow
JavaScript overwrite semantics and later support computed keys.

Entry descriptor arrays such as `[":", key, value]` are **structural operands**, not
independently evaluated EDAG nodes: nothing in the interpreter ever evaluates a
descriptor as a value, so no running program can ever observe whether one was reused by
reference or merely built twice with equal content. The `key` and `value` operands
*are* real EDAG nodes, and their identities are shared normally, exactly like any other
node.

*Rejected: forbidding descriptor-array identity reuse.* An earlier draft of this
resolution required validation to reject a descriptor array reused across more than one
entry position (`["{}", e, e]` for one shared `e`), reasoning that unobserved sharing
should not add a hidden graph/hash distinction. Dropped, because the rule cannot be
stated in a way that means the same thing on every conforming VM:

- A content-addressed VM interns pure data unconditionally — two descriptors with equal
  content (`[":", "x", 1]` written twice, an explicitly allowed duplicate entry) become
  the same reference the moment they are interned, authored sharing or not. A validator
  that rejects `e === e` after interning has already happened rejects that ordinary,
  legal object too — it cannot tell "the author shared this" from "the VM unified it."
- A non-content-addressed VM never does this unification, so the same check never fires
  there for the same written EDAG.

The same input would therefore pass on one conforming VM and fail on another, which is
not a validation rule at all — it is VM-dependent behavior, and the core invariant rules
that out for anything a running program can observe. Since descriptor identity is
*not* observable, there is also nothing it would protect: the two VM kinds may legally
disagree about whether a `["{}", ...]` node's descriptor arrays are the same reference
after a serialize/parse round-trip (a non-CA VM keeps two distinct, equal arrays; a CA
VM unifies them into one), and both are correct, because a running program can only ever
observe the `key`/`value` nodes inside a descriptor, never the descriptor itself. A rule
with no observable purpose and no VM-independent statement is not worth the demand it
places on every implementation — it is simply removed rather than kept "for safety."

The sequence is retained exactly as written. It matters for several
independent reasons:

- JavaScript evaluates object-literal definitions in source order;
- duplicate keys and, once admitted, computed keys can overwrite properties created
  by earlier entries, so the final object can depend on entry order;
- insertion order of non-index string properties is observable through
  `Object.keys`, iteration, and `JSON.stringify`.

One caveat remains: two EDAGs that differ only in the order of distinct,
static integer-index keys can still produce the same JavaScript value. For
example, `["{}", [":", "2", a], [":", "1", b]]` and
`["{}", [":", "1", b], [":", "2", a]]` both enumerate as `"1", "2"`.
Hash-as-written still distinguishes the EDAGs, but the core invariant's
print-run-compare test cannot distinguish this pair. Computed keys,
duplicate keys, and key/value computation can make entry order observable;
the caveat is specifically that not every distinct written order denotes a
distinct JavaScript value.

A4's opaque-error contract permits an engine to schedule independent key and
value computations differently when doing so is unobservable, but the object
must be produced **as if the entries were applied in their EDAG order**.
Sorted-key canonicalization (as `fjs compile` applies to data output,
[spec/README.md](../spec/README.md)) must therefore not be applied to object
constructor entries.

Duplicate properties are allowed, as in JavaScript; the later entry wins.
This is also required once computed keys are admitted, because equality of two keys
may not be knowable during EDAG validation.

The entry vocabulary is extensible. A later `["...", object]` entry can
represent object spread, `{ ...object }`, without changing `["{}", ...]`.
Plain objects remain reserved for a future EDAG use.

**`__proto__` is a data key, never a prototype assignment.** In an EDAG
entry, `[":", "__proto__", value]` defines an ordinary own property. When
printing it as JavaScript (subject 12), the printer must use the computed
spelling `{ ["__proto__"]: … }`, the only object-literal form that
reproduces that value. The identifier and string spellings assign a prototype
instead and lose the property. This is the rule the DJS parser and serializer
already follow —
[spec: the `__proto__` key](../spec/README.md#the-__proto__-key).

#### 5. Validation

**Status:** open (list agreed in direction). The RTTI schema is written —
[`fjs/edag/module.f.mjs`](../fjs/edag/module.f.mjs) — and checks shape only:
constants, the single-node body, unknown tags, entry forms and the form of a
property operand. The rest of the list is not checked today
([Caveats](../fjs/edag/README.md#caveats)): the property operand does not yet
exclude the prohibited names, acyclicity and the `"=>"` scope rule go
unchecked, and the `","` well-formedness rule is left to the emitter.
Whether that `","` rule belongs to validation, as this list says, or stays
the emitter's, as the README says, is open.

The EDAG is the `Function` constructor's public input and will see shapes
the FJS compiler would never emit. To validate:

- constants: function values in constant position are a validation error —
  a function is a `"=>"` node, never a constant
  ([functions](../spec/README.md#functions));
- the body: a single operation node;
- `","` (when introduced): at least two operands — a single-operand
  `","` is the identity and non-canonical; an assert operand reachable
  from another operand of the same `","` is redundant (well-formedness,
  subject 8);
- unknown command tags: validation error;
- object constructors: every element of a `["{}"]` node's entry array must be
  a recognized entry form; `[":", key, value]` admits any node in `key`, not just a
  string constant (subject 4). Duplicate property keys/entries are valid and are
  applied in order (subject 4). Entry descriptor containers are structural
  and never independently evaluated, so their identity is not checked —
  reusing one across entry positions is unobservable and, on a
  content-addressed VM, indistinguishable from an ordinary duplicate entry
  (subject 4); key/value EDAG nodes inside descriptors may of course be
  shared, like any other node. Plain objects are not EDAG nodes;
- **property operands** of `"."`, `"?."`, and the property chain steps: a permitted string
  constant, a number constant, or a `"Number"` node. Anything else is a
  validation error, which is what keeps computed-string prototype access
  unrepresentable ([Operations](#operations)). `"Number"` never returns a
  string, so it can never rebuild a prohibited name at run time — unlike
  `"+"`, which concatenates at its binary arity
  (`[".", o, ["+", "constr", "uctor"]]` would reach `Object`) and at
  unary arity yields a number, never a string. The prohibited-name list comes
  from
  [property-accessor](../spec/todo/2330-property-accessor.md), and
  because the key is a *constant* the check happens once, at
  construction, not on every access;
- object-constructor key `"__proto__"`: **not** a validation error — it
  denotes an ordinary own property (subject 4) — but it constrains
  printing, since `{ "__proto__": v }` as JS assigns a prototype instead
  ([spec: the `__proto__` key](../spec/README.md#the-__proto__-key),
  subject 12);
- **acyclicity**: DJS cannot express cycles (const-before-use), but an
  `Any` handed to the `Function` constructor can be built by other means —
  cyclic node graphs must be rejected;
- aliasing of **operation nodes is valid only within one function EDAG scope**:
  referencing the same node from many operand positions in that scope is the sharing
  mechanism (subject 1), but an operation-node identity must not cross a `"=>"`
  function boundary (the closed-scope model above). Structural containers that are not
  nodes, such as object-entry descriptors, follow their operation-specific canonicality
  rules above instead. The initial Stage 2 validator/proofs for this boundary are tracked
  by [`compile-modules-to-edag.md`](../fjs/fsc/todo/compile-modules-to-edag.md).

#### 6. Command vocabulary vs. the existing spec names

**Status:** decided (source/EDAG/bytecode mapping reconciled)

The [source-to-EDAG mapping](../spec/todo/2330-property-accessor.md#source-to-edag-mapping)
distinguishes source admission, semantic graph nodes and optional backend
specializations. The historical names `at`, `at_call`, `instance_property`,
`instance_method_call` and `own_property` described bytecode sketches, not a
one-to-one mapping to EDAG tags. In particular, the old `own_property` name
was used both for a static fallback and for an explicit runtime lookup; it
must not direct an ordinary static read to internal `own`.

Every admitted constant-key read is `.`. A method call is a property step
owning a call continuation, not a detached `()` over a completed read.
Backends may specialize these operations or share lookup helpers where their
semantics agree. Such reuse changes neither the source operation nor its
EDAG representation. [`entry`](../fjs/edag/todo/entry.md) separately owns the
runtime helper API and internal-opcode migration, not static-name fallback.

An earlier draft added: "consequence — the EDAG interpreter carries the
safety burden 2330 assigns to compile-time checks; prohibited names must
be rejected at *runtime*". That no longer holds. The property operand is
restricted syntactically ([Operations](#operations)), so a prohibited
name is a **validation** error at construction, and a computed string
never reaches `"."` at all.

**Decided for the structural tags: they are JS syntax too** —
`[".", object, property, k]`, `["()", callee, args]`,
`["{}", …]`, `[":", key, value]`, `[",", …]`. Syntax is as much a host
spelling as an operator symbol is. This supersedes the
`at` / `call` / `bindCall` names used earlier in this document.

**Decided: `"."`, not `"[]"`.** `"."` is the shorter and more readable
tag for property access.

**Decided: no `".()"`; a chain node owns its continuation.** An
earlier draft gave the method call its own `[".()", object, property, args]`
tag. It was replaced because a JS chain carries two kinds of hidden control
flow that a fixed property-plus-call tag cannot express: the receiver a
property access hands to a following call as `this`, and the region an
optional link short-circuits — and parentheses move each boundary
independently (`(a?.b).c` throws where `a?.b.c` is `undefined`). The
settled vocabulary keeps every `exp` evaluating to an ordinary value and
carries both kinds of control flow in a **continuation** operand: a linked
chain of steps that only `"."`, `"?."`, and `"?.()"` interpret. `a.b(...c)`
is then `[".", a, "b", ["|()", c]]`, and the vocabulary also spells
chains no property-plus-call tag could, such as `(a?.b.c)(...d)`.

An intermediate revision made that operand a flat *array* of steps held by
`"()"`, `"?."`, and `"?.()"`. It was replaced in turn: an array states
neither the order nor the cardinality of what may appear in it, so four
families of duplicate spellings validated and the minimality rule had to
live in prose. The three continuation types — one per state of the two
control-flow bits — make those families unspellable instead. The shape of
record and the worked examples are in
[`fjs/edag/README.md`](../fjs/edag/README.md) — "Chains" — and the JSDoc on
the lambda schemas in
[`fjs/edag/module.f.mjs`](../fjs/edag/module.f.mjs).

**Decided: semantic access classes are not bytecode specializations.**
Static/numeric access and the runtime enumerable-entry helper have different
source meanings. Both must preserve their own admitted observations; sharing
a backend lookup routine does not make the operations interchangeable.

|EDAG|Semantic role|Source boundary|
|---|---|---|
|`[".", o, p]`|permitted constant-key or numeric read|includes non-enumerable `length`; not an entry filter|
|`[".", o, p, ["\|()", args]]`|the same access with a receiver-preserving call|subject to the call admission, `fjs/js/prototype`'s `prohibitedCalls`: a built-in member function the read refuses may be called|
|`['entry']` (proposed), used through ordinary `()`|enumerable-entry helper function|only the complete approved AST pattern, per [entry](../fjs/edag/todo/entry.md)|
|`["own", o, k]`|internal operation|no standalone source spelling or static-read fallback; semantic migration belongs to `entry.md`|

Every permitted static name stays on the `.` path, whether or not a built-in
table lists it. A backend can specialize a known read without changing the
EDAG, but cannot replace ordinary access with an enumerable-only lookup.
Existing host helpers and opcode implementations are unchanged by this
mapping correction. The source writer's refusal of bare internal `own`
does not apply to static reads represented by `.`.

**Decided: the array constructor is `"[]"`.** Choosing `"."` for access
freed the tag, and `[a, b]` is precisely how JS spells an array literal.
The earlier objection — that `["[]", a, b]` would read as both a
two-element array and `a[b]` — disappeared with access moved to `"."`.

**Decided: the object constructor is `"{}"` with ordered entries.**
`["{}", [":", key, value], …]` preserves construction order and leaves
room for computed keys once their semantics are admitted; it can later accept
additional entry forms such as `["...", object]`. Plain objects are
deliberately left unused by EDAG.

Word tags now survive only where JS genuinely has no expression spelling:
`"args"`, `"frame"`, `"self"`, `"throw"`, `"own"`.

#### 7. Top-level shape of a function

**Status:** function-node shape and fixed/rest bindings implemented in #2237;
the constructor's input API remains open.

The body is an expression graph in `['=>', length, frame, body]`, following
the [named-and-rest parameter plan](../spec/todo/3120-parameters.md).
The three-element `["=>", frame, body]` in the historical
[Operations](#operations) examples is superseded.

`length` is canonical nonnegative integer metadata, not an expression
operand; the invocation bindings are the fixed/rest pair in subject 2,
not a count added to the old complete-arguments model. The function node
owns its arity. The implementation request recorded in the parameter plan
selected this replacement; the old invocation model is not a parallel
contract. This does not settle the constructor's input API or default-text
choices.

The function-text exception does not permit changing arity. The current
writer emits fixed parameters plus rest, retaining unused fixed positions;
`['arg', N]` and `['rest']` render as those bindings. The earlier writer
obstruction for positive arity plus complete `['args']` does not apply to
this new format, which cannot express that combination. Unrelated source
serialization questions in subject 12 stay separate, but the adopted
EDAG-derived default-text rule is still required: use the shared renderer
or explicitly refuse unsupported observations before exposing wrapper text
([default-text boundary](../spec/todo/3120-parameters.md#default-function-text-render-or-refuse)).

Hand-written factories can materialize these functions without the
[length pattern](../spec/todo/arity-complete-arguments.md) for arity within
an executor's table capacity. That capacity limits materialization, not valid
source or EDAG: source writers emit the declared parameter list directly.

#### 8. `","`: anchored evaluation

**Status:** decided (revised: the merge is the `","` operation)

**Resolution: non-resulting computations are merged into the graph by
the `","` operation — `[",", [...asserts, result]]`, the JS comma
operator — which guarantees *membership*, not order.** Introduced in
`fjs/fsc/edag` after Stage 1, for what a module's export does not reach;
these rules bind it.

- A throw is an effect. A reference edge can only express "the result is
  needed here"; a may-throw operation needs "evaluate this even if its
  value is never needed". A pure data-flow DAG has no edge type for
  that, so the format needs dedicated syntax: `","`'s assert-operand
  positions are exactly those effect edges. (Graph IRs solve this the
  same way: effect edges alongside data edges.) Being an ordinary
  operation, `","` composes anywhere in the graph — body root, or
  inside a future control branch — one mechanism for all scopes.
- **Only true roots need merging.** A source const whose value the
  result uses is already a member by reachability — it collapses into
  an interior shared node. Only non-resulting roots — the asserts —
  need a `","` operand; at the source level, an unused `const` *is*
  the assert syntax. Identifying roots is **reachability, not effect
  analysis**: the EDAG's shape does not depend on any analysis's
  precision, preserving hash stability across compiler versions.
- **Well-formedness: merged operands are true roots** — an assert
  operand must not be reachable from any other operand of the same
  `","`. Without this rule the same function could be spelled with or
  without redundant merged-but-referenced operands, needlessly
  splitting hashes. A single-operand `","` is the identity and
  equally non-canonical.
- **Branch ordering: the spec owns the spelling; engines own the
  schedule.** What matters for the specification is **canonical order**:
  the result operand at its fixed last position (the JS comma reading),
  and (eventually) a canonical order for the asserts before it — the
  leading candidate is
  **lexicographical content-hash order**, which gives the function a
  stable hash regardless of how the source ordered its asserts, with the
  hash as its own total order and tie-breaker (details ride on the
  canonical graph serialization, subject 9). Not for the first
  implementation.
  How engines *prioritize* branches is deliberately unspecified — order
  is not semantic, so any schedule is legal: racing cheap guards first
  (fail-fast), parking expensive branches, full parallelism, or plain
  sequential. A `throw` in FS is the analogue of a panic in other
  languages, so engines may reasonably assume asserts rarely fire and
  optimize for the happy path. The spec assumes nothing about any of
  this; the freedoms above are illustrations of what A1–A4 make sound
  for any engine, with no coordination.
- **Membership is never negotiable: a `","`'s value is revealed only
  after ALL its operands complete successfully.** Scheduling freedom is
  about *when* guards run, never *whether*. When the guarded `","` is
  the body root, its value is the function's value — so nothing escapes
  to the caller until every guard passes. This is more than A3 fidelity
  — an assert may be a security guard whose failure must prevent the
  result from ever reaching the caller:

  ```js
  const getValue = key => { assert(key !== 'password'); return map[key] }
  ```

  An engine may compute anything early — even the result operand
  speculatively, which is unobservable — but the `","`'s value must
  not be revealed until every assert operand has succeeded.

  "Succeeded" is an **as-if** rule — the engine must *establish* each
  branch's success, not necessarily *execute* it:
  - **proof instead of execution**: a guard proven never to throw
    (types, value analysis) is established without running — A4's
    unobservability makes proof and execution indistinguishable;
  - **cache instead of execution**: by A1 any outcome is a pure function
    of content and inputs, so a content-addressed cache hit *is* the
    computation — CAVM's premise: hash of (function, arguments) →
    result. Only *semantic* outcomes are cacheable — a value, or a
    mandated failure (A3); an A2 interrupt is an engine artifact, never
    a cacheable verdict.

- **Asserts are contracts, not validation.** A developer must never use
  asserts to validate untrusted input — a function handling an HTTP
  request must not guard the request with asserts, or any user can crash
  the program (a DoS vector). Untrusted-input validation is an ordinary,
  *expected* outcome and belongs in values
  ([`Result`](../fjs/types/result/module.f.mjs) /
  [`Nullable`](../fjs/types/nullable/module.f.mjs)); an
  assert firing means the program itself is wrong — a breach of an
  internal API contract. The opaque-error contract (A4) enforces this
  discipline by construction: an error carries no information, so an
  assert *cannot* tell a caller what was wrong with their input —
  validation that needs to explain itself must produce a value.

  Asserts and throws are fully at home in **tests**. A test framework is
  a host, not FS code — it sits on the out-of-band side of the A4
  contract, where diagnostics already flow — so it may reveal everything
  about a triggered assert (which one, where, with what context) to the
  human. Contract breaches are precisely what tests exist to detect.

  An engine that actually *skips* assert branches is conceivable only as
  a **debug mode** — a development tool showing the would-be result even
  when guards would fail. Such a mode is non-conforming by definition:
  never a default, and its results must never enter the
  content-addressed cache or otherwise escape the debugging session —
  they are not the function's outcome.
- **Membership is semantic; order is not** (A4 rejected): every merged
  operand is established before the merging `","`'s value is revealed,
  so A3's always-fails holds — but any evaluation order of branches
  (including parallel, and asserts as fail-fast guards before the data
  path) is legal under the opaque-error contract. Data dependencies
  still order evaluation; lazy operands (subject 3) are still never
  speculated.
- Memoization by node identity: a shared node evaluates once, at its
  first demand.
- Future: a control-flow branch operand (an arm of `"?:"`, subject 3)
  carries its guards as a `","` node inside the arm — per-branch effect
  membership with no extra machinery.

#### 9. Canonical graph serialization and hashing

**Status:** parked — deliberately deferred; not part of the stage 1
discussion. The notes below are kept so nothing is rediscovered later.

Sharing is semantic (subject 1), so the canonical byte form must encode
the **graph**, not a tree expansion:

- deterministic CBOR needs sharing support (the IANA-registered
  value-sharing tags 28/29, or a profile-defined equivalent) with a
  canonical placement rule — e.g. first use in evaluation order is the
  definition, later uses are back-references. The back-reference indices
  are **derived** from the graph, never authored (subject 1). Affects
  the CBOR task in [mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md).
- Hash-consing / content-addressed dedup must **not** merge structurally
  identical constructor nodes: `["[]", ["{}"], ["{}"]]` and
  `const x = ["{}"]; ["[]", x, x]` are semantically different, and a
  naive structural hash conflates them. The hash must be computed over
  the canonical graph serialization.
- JSON output expands sharing ([spec/README.md](../spec/README.md)) and is
  therefore not a valid EDAG carrier; DJS and tagged CBOR are.
- Nested functions no longer pose the binders-plus-sharing difficulty:
  the closed-scope model ([Operations](#operations)) makes each function
  body a self-contained graph, so it hashes independently and no
  reference is context-dependent across a boundary.
- Still open: **mutual recursion**, where `a` calls `b` calls `a`. That
  is a cycle *between* functions, which `["self"]` does not reach —
  either the partner is passed as an argument, or the group is hashed
  together with members addressed by index.
#### 10. Free variables: module consts, imports, built-ins

**Status:** open

**The source rule: declare before use, plus self.** A nested function may
reference any `const` defined *before* it, and itself — nothing else
([forward-references](../spec/todo/3140-forward-references.md),
[spec/README.md](../spec/README.md)):

```ts
const a = 0
const f = () => {
   const x = a * 3              // ok — a is defined before f
   const z = x === 5 ? f() : 6  // ok — f may reference itself
   const y = b * 4              // error — b is not defined before f
   return x + y
}
const b = 3
```

In `f`'s body, `a` is a captured value — frame slot 0 — while `f()` is
`["()", ["self"], ["[]"]]`, needing no frame entry at all.

This is exactly what makes frames constructible. `["=>", frame, body]`
evaluates its `frame` operand *first*, so every captured value must
already exist; a forward reference would need a value that does not
exist yet — a cycle, which subject 5 forbids. And it is why `["self"]`
must be a primitive rather than a frame slot: self-reference is the one
case where a function legitimately refers to something that does not
exist when its frame is built.

**The relaxation is an acyclicity rule.** Allowing a forward reference
whenever the referent's computation graph does not depend on the
referring function is precisely "the value graph stays a DAG". It is
sound because *textual order is not observable*: module consts are pure
(A1) and their failures are opaque (A4), so a compiler may topologically
reorder them. What must hold is the dependency DAG, not the source
order — the EDAG encodes no source order at all.

**For now the design is built around `["self"]`** — direct
self-reference is a primitive, and everything else arrives through the
frame. A later redesign (a group mechanism for mutual recursion, or a
different binding scheme entirely) is expected and welcome: breaking
changes that improve the design are the repository's norm
([DESIGN.md §2](../doc/DESIGN.md)), and nothing here is load-bearing for
compatibility yet.

Mutual recursion stays excluded even under the relaxation (`b` would
depend on `f`), consistent with the open item in subject 9. Note that
3140's proposed workaround —

```ts
const x = { a: () => x.b(), b: () => x.a() }
```

— is not merely a forward reference: under the frame model each closure
would capture `x` while `x` is still being constructed, a cycle in the
*value* graph. It needs the group mechanism from subject 9 (or passing
the partner as an argument), not just relaxed ordering.

The EDAG's only leaves are constants and bindings — `["arg", N]`, `["rest"]`
and `["frame"]` in a function, the import `["args"]` in a module (subject 2).
Nothing references a name the function did not compute itself:

- a module-level `const` or `import` the body uses
  ([const](../spec/README.md#shared-values-constants),
  [default-import](../spec/README.md#importing-other-modules));
- a captured const, once closures exist — the frame
  [function-frame](../spec/todo/3111-function-frame.md) designs;
- a built-in namespace such as `Object` or `JSON`
  ([built-in](../spec/todo/2360-built-in.md)), which
  [2360](../spec/todo/2360-built-in.md) says may be used only as a
  namespace, never assigned to a variable.

**Largely answered by `["frame"]`** ([Operations](#operations)): free
values are captured into the frame when the closure is created, and read
back as `[".", ["frame"], i]`. `["self"]` covers self-reference, which
no frame can seed at the top level. What remains open:

- **which values go into a frame, and in what order** — the compiler
  decides, and hash-as-written (subject 1) means that choice must be
  canonical: same source, same frame layout;
- **built-in namespaces** (`Object`, `JSON`) — frame entries like any
  other free value, or constants the VM provides?
  [2360](../spec/todo/2360-built-in.md) says they may be used only as
  namespaces, never assigned, so they may not be ordinary values at all;
- **module consts and imports** — captured per closure, or embedded
  directly as values (they are already-evaluated DJS values by then)?
  Embedding inlines a shared value into every function that uses it,
  which costs hashing and `toString(f)` fidelity.

Stage 1 can live without this — a body reachable from `["args"]` and
constants alone is a real, if small, language. But every path forward
needs it, so the shape should be chosen deliberately rather than by
accident:

1. **A leaf operation** — `["const", …]` / `["capture", i]`: explicit,
   and the natural home for 3111's captured-consts frame.
2. **Direct value embedding** — the referenced value *is* the constant,
   since imports and module consts are already evaluated DJS values by
   the time a function is built. Simplest, and it fits "the EDAG is an
   `Any`"; but it inlines a shared value into every referencing
   function, which matters for hashing and for `toString(f)` (a
   reference to a named const would print as its expansion).
3. **Built-ins as constants** — the built-in namespaces are values the
   VM provides; embedding them collides with 2360's rule that they are
   not assignable, so they may need their own leaf regardless.

Related: `["throw", …]` exists as an operation partly because it needs
none of this ([Operations](#operations)).


#### 11. `let`, loops, and tail calls

**Status:** open

Everything expressible by looping is expressible by recursion —
`["()", ["self"], args]` with a `"?:"` base case — and the NaNVM may
implement **TCO** — but most JavaScript engines do not, and FS
compiles to JavaScript (`.f.js`) as well as to Rust. A recursion-only
language would therefore stack-overflow on ordinary JS engines for
ordinary loops. [let](../spec/todo/3220-let.md) exists to give loops a
trampoline instead.

**The hard constraint: a mutable variable is not a DAG node.** A node
has exactly one value; a `let` has a different value per iteration. So
`let` can never be modeled by adding a "variable" node — it must lower
to **explicit state threading**, where each iteration's state is a
value. That keeps A1 purity (a local mutation that never escapes is
unobservable) and keeps the no-statement-nodes property above: a loop is
an *expression* that evaluates to the final state.

Two shapes to decide between:

1. **A loop operation** — the EDAG gains a primitive whose operands are
   the initial state and a step (a `["=>", …]` node, subject 7)
   from state to state; source `let` + `while` lowers to it. Every
   backend emits a real loop; nothing depends on TCO. Costs: a new
   operation, and a second way to express iteration alongside recursion,
   so the compiler must pick canonically (subject 1's hash-as-written).
2. **Recursion only, TCO in the backend** — the EDAG expresses loops as
   tail calls, and backends that lack TCO implement it themselves:
   self-tail-calls become a `while` loop, mutual recursion a trampoline.
   Keeps the EDAG minimal and iteration single-spelled; costs a required
   transformation in every non-TCO backend, and trampolining overhead
   where the simple case does not apply.

Note that A2 does *not* rescue option 2 by itself: a stack overflow is
an engine artifact an engine may report as a failure, but a language
whose ordinary loops overflow on a major target is not portable in
practice — the reason `let` is on the roadmap at all.

Related: [mutability](../spec/todo/mutability.md) treats `let` as stage
zero of ownership tracking; whatever shape is chosen here must not
require the EDAG to model mutable *objects*, only threaded state.

#### 12. `toString(f)`: real, runnable source

**Status:** reopened — callable-source requirements are conditional for `String(f)`.

This section describes self-contained callable source serialization and candidate
techniques for it. The earlier identification of that serializer with
`toString(f)` is withdrawn. Whether `String(f)` has the same output contract,
whether it includes the captured frame, and how each operation represents
`self` are the three open questions in
[Function text and serialization](../spec/todo/serialization.md#function-text-and-serialization).
That document owns those decisions; the requirements below apply to `String(f)`
only if the corresponding callable-serialization contract is selected.

The [function-source exception](../spec/README.md#function-source-representation-exception)
**is adopted**: default FJS function text comes from associated EDAG, not
original spelling. This permits direct, indirect and exported source-text
observations to differ from a JavaScript host; it neither requires a closed
callable string nor decides any frame or `self` strategy. The source must still
obey the applicable syntax and output contract.

For a serializer that promises to reconstruct an equivalent callable in a new
environment, the following constraints apply within its supported domain:

- **Faithful admitted source.** Every printed operation needs a faithful
  source form. A `throw` wrapper or a named function for `self` remains a
  candidate, not permission to emit unsupported FunctionalScript. The JavaScript
  host used to read an example is not permission to use `eval` inside FJS.
- **No alternate `own` API.** The direct descriptor-value spelling remains
  retired. Follow [`entry`](../fjs/edag/todo/entry.md): print the complete helper
  and ordinary calls, and refuse bare internal `own`. Its exact spelling follows
  the adopted function-text exception and open rendering questions, not a
  requirement to recover authored text. A printed helper's intrinsic `Object`
  reference still depends on the declared built-in environment; AST-to-EDAG
  compilation validates that binding without admitting the namespace as a value.
- **Preserve the profile's sharing and identity.** Shared identity-minting
  computations must not be duplicated, and distinct allocations must not be
  merged in the JS-compatible model. A captured object must not become a new
  allocation on every invocation. Reconstructed identity relationships are the
  requirement, not retaining the original process's object addresses.
- **Self-contained captures.** A callable serializer cannot rely on the
  originating module's local bindings existing in the destination environment.
  It must represent the relevant captured values and relationships. This is
  not a statement about whether `String(f)` includes frames; that choice is open.
- **Frame bindings are a candidate technique.** One possibility is to emit
  enclosing `const` bindings that nested functions capture, or to represent a
  whole frame as an array. For illustration, not as a selected serializer:

  ```js
  const captured = [];
  const restored = () => captured;
  export default [restored(), restored()]; // the two entries share one array
  ```

  In contrast, `const restored = () => [];` creates a fresh array per call.
  The placement and lifetime of bindings matter; generated names and frame
  layout remain part of the rendering decision, not an answer hidden here.
- **Captured functions and `self` need finite representations.** A complete
  callable may require rendering a graph of captured functions and values,
  preserving shared dependencies rather than expanding a tree. Recursive calls,
  returning `self`, and references to enclosing functions must keep the correct
  binding. Wrappers, generated bindings and named functions remain alternatives.
  If `String(f)` includes frames, the
  [conditional lazy-rendering requirement](../spec/todo/serialization.md#conditional-requirement-lazy-frame-rendering)
  applies; self-contained output does not mean eager materialization.
- **Data keys keep their meaning.** In an object literal, an own `__proto__`
  data key needs the computed spelling `{ ["__proto__"]: value }`, not a
  prototype-setting property definition ([spec](../spec/README.md#the-__proto__-key)).

A callable round trip must reconstruct the promised behavior under its declared
profile, including captured sharing and `self` where supported. Parsing produces
the JavaScript-subset AST; checked AST-to-EDAG compilation supplies the admission
and semantic checks. Internal or unsupported operations remain explicit refusals.

Reproducing exactly the same code graph, frame layout and hash is a stronger,
separate round-trip property. Frame materialization can change that representation;
exact reconstruction needs an agreed normalization/encoding contract (subjects 9
and 10). It is not an automatic consequence of callable equivalence, nor an
unconditional guarantee for `String(f)`. Compare original-source behavior too,
subject to the specified exceptions; comparing output with itself proves neither
source compatibility nor the closure contract.

Deterministic rendering for chosen inputs remains required. Whether `String(f)`
and callable serialization share contents, implementation or a canonical format
is owned by the linked open questions, not settled by this historical section.

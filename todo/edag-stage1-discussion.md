# EDAG stage 1: discussion

**Priority:** P2
**Status:** open — working document for designing the stage 1 function
EDAG (expression DAG — see the core invariant).
Each subject below is resolved separately; once all are **decided**, the
result is distilled into a concrete design in [edag-spec.md](./edag-spec.md)
and this document is deleted.

## Baseline: an expression DAG with anchored evaluation

*This baseline supersedes the original index-based sequence proposal; the
revision history is recorded in subjects 1 and 8.*

A function body is a **single operation node** — the root of the
expression DAG. Non-resulting computations (asserts — fail-fast
guards, A4) are merged into the graph by the **`","` operation**:

- `[",", ...asserts, result]` establishes **all** of its operands
  (subject 8) and takes the value of the **last** one — it *is* the JS
  comma operator, `(a, b) → b`. The assert operands' values are
  discarded — they exist for their throw-potential only — and are
  unordered among themselves (A4). Result-last buys source fidelity:
  the future source pattern

  ```js
  return assert(a >= 0 && b >= 0), a + b
  ```

  lowers to a `","` node verbatim, `toString(f)` prints it back
  verbatim, and a JS engine running the printed source implements one
  legal schedule (left-to-right, eager) of the same semantics. The
  statement spellings normalize to the same node — all four of

  ```js
  const f = a => { assert(a >= 0); return a + 2 }
  const g = a => { const _ = assert(a >= 0); return a + 2 }
  const h = a => { return assert(a >= 0), a + 2 }
  const k = a => (assert(a >= 0), a + 2)
  ```

  are one function with one EDAG and one hash. The last spelling — an
  expression-bodied arrow, no block, no `return` — is the most compact
  and the natural form for `toString(f)` to print. The EDAG has **no
  assert node**: what makes an operand an assert is purely positional —
  its value is discarded by `","`. The guard itself is either an
  ordinary function value that throws on a falsy argument, or, with no
  free-variable machinery needed,
  `["?:", cond, undefined, ["throw", …]]` ([Operations](#operations),
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
    `false`, `undefined`, `null`, `34n`;
  - an **object** — an object constructor; each property value is an
    operation node;
  - an **array** — a tagged tuple `[tag, ...operands]`; the tags are
    listed in [Operations](#operations) below.
- operand positions hold **real references** to nodes, not indices.
  Referencing the same node from two positions is **semantic sharing**: the
  node is evaluated once and its result reused. `const x = {}` then
  `[x, x]` yields an array with `a[0] === a[1]`, while `[{}, {}]` yields
  two distinct objects.
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
    [".", a, 1],                    // the result: last, as in JS (a, b) → b
]
```

### The core invariant

**Any validated EDAG behaves on the VM exactly as the corresponding
source behaves on a JavaScript engine.**

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
**primary**: sharing is observable (`[x, x]` and `[{}, {}]` are
different functions, subject 1), so no tree denotes what an EDAG
denotes, and the sharing is authored rather than recovered by analysis.

Related representations, for orientation: *term graphs* in the
term-rewriting literature are the same structure (though often
permitting cycles, which validation here forbids); the **VSDG** (value
state dependence graph) is the closest compiler IR, since its state
edges play the role of our `","` operands; *sea of nodes* is the same
family but carries control edges and a scheduling phase this design
does not have.

*AST* is now reserved for **BNF parser output** ([fjs/bnf](../fjs/bnf/README.md),
[fjs/djs](../fjs/djs/README.md)); the function representation is the EDAG
everywhere else.

"Behaves the same" means, precisely, under the assumptions:

- the same value whenever both complete (A1, A2);
- failure exactly when JS always throws (A3) — plus engine interrupts,
  which are not the function's behavior (A2);
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
- **The printed source is the semantic reference.** Every validated
  EDAG has a source form (subject 12), a JS engine runs that source,
  and the two must agree — so `toString(f)` is not merely a feature but
  the statement of what the graph *means*. It also makes the invariant
  testable: print, run on a JS engine, run on the VM, compare.

Agreed points (not under discussion):

- Host-value reuse follows [DESIGN.md §8](../DESIGN.md): constants describe
  themselves; tags only where the host value is ambiguous. `["[]", ...]`
  is a complete escape hatch — any constant array is expressible.
- `[".()", …]` is semantically required, not an optimization:
  [property-accessor](../spec/todo/2330-property-accessor.md) shows
  `a.indexOf(x)` and `const p = a.indexOf; p(x)` differ observably.
- `args` is **a single operand that evaluates to an array**, not a
  literal list of operand nodes: `f(a, b)` is
  `["()", f, ["[]", a, b]]`, while spread `f(...xs)` is just
  `["()", f, xs]` and forwarding is `["()", f, ["args"]]` — free,
  because `["args"]` is itself a first-class array (subject 2). A
  literal-list operand would save the `["[]", …]` wrapper in the
  common case but would need a spread marker for those. Same for
  `[".()", …]`'s third operand.

## Operations

The operations we want, with their stage. Every operand is an operation
node; `node` below means any of them.

### Structural operations

|Form|JS|Stage|Notes|
|----|--|-----|-----|
|`2.5`, `"a"`, `true`, `null`, `undefined`, `34n`|itself|1|constant — any non-object, non-array value|
|`{ key: node, … }`|`{ key: … }`|1|object constructor; key order is part of the value (subject 4)|
|`["[]", ...node]`|`[…]`|1|array constructor|
|`["args"]`|—|1|the arguments array (subject 2)|
|`[".", object, property]`|`o.p`, `o[p]`|1|property access; `property` is restricted (see below)|
|`["()", object, args]`|`f(...args)`|1|call; `args` is one node yielding an array|
|`[".()", object, property, args]`|`o.p(...args)`, `o[p](...args)`|1|method call; keeps `this` binding; same `property` restriction|
|`["own", object, key]`|`Object.getOwnPropertyDescriptor(o, k)?.value`|1|own property by a computed **string**; no prototype chain|
|`["Number", node]`|`Number(x)`|later|numeric coercion that accepts bigints, unlike unary `+`|
|`[",", ...node, node]`|`(a, b)`|later|membership without order (subject 8)|
|`["=>", frame, body]`|`(…) => …`|later|closures; `frame` yields the captured array (see below)|

Tags are **JS syntax wherever JS has syntax for the operation** — hence
`"."`, `"()"`, `".()"` and `","` above, and the operator symbols
below. This is [DESIGN.md §8](../DESIGN.md) again: the host language
already spells these, so the EDAG reuses the spelling instead of
inventing a vocabulary to be memorized and translated. `".()"` reads as
the method call it denotes, `o.p(…)`.

**The property operand is restricted**, in `"."` and `".()"` alike. It
must be one of:

- a **string constant** that is not on the prohibited list
  ([property-accessor](../spec/todo/2330-property-accessor.md):
  `constructor`, `__proto__`, the instance methods, …);
- a **number constant**;
- a node tagged `"+"` (unary) or `"Number"` — each guaranteed to yield
  a number or throw.

So a run-time-computed **string** can never reach `"."`. This is a
*syntactic* rule, checkable when the `Function` constructor validates
its input (subject 5), which is what 2330 already asks of the byte code:
the expression inside `[]` must be a unary `+`, a number literal, or a
permitted string literal.

The point is that the dangerous case becomes **unrepresentable rather
than checked**: prototype-chain lookup by a computed name — the abuse
2330 documents (`f.constructor("…")`, `__proto__`) — has no spelling in
the EDAG at all.

Unary `+` throws on a **bigint**, so `["Number", node]` exists as the
converting alternative; it is spelled by its JS built-in, `Number(x)`.

Accessing a property by a **computed string** is a different operation,
`["own", object, key]` — own properties only, no prototype chain, so a
computed name is harmless. Its JS spelling is a pattern rather than
syntax:

```js
Object.getOwnPropertyDescriptor(object, key)?.value
```

FunctionalScript recognizes that construction and lowers it to the
single operation — the same whitelisted-pattern mechanism that gives
`assert(…), result` its `","` node
([spec/README.md](../spec/README.md)). Note `?.` is not an FS operator
in its own right; it exists only inside this recognized pattern.

`"=>"` is the function constructor because FS has only **arrow
functions** — there is exactly one spelling to reuse, so the tag is
unambiguous. (`toString(f)` printing `["self"]` as a *named function
expression* is a separate matter: that is the printer working around
JS's lack of an expression for self-reference, not a second function
form in the EDAG.)

Word tags remain only where no unambiguous JS spelling exists:

- `"args"` — FS has no `arguments` object to borrow a spelling from
  (subject 2);
- `"frame"`, `"self"` — JS has no expression for either (`arguments`
  is not FS's model, and `arguments.callee` is forbidden in strict
  mode);
- `"throw"` — a JS keyword, but a *statement*, so there is no
  expression spelling to reuse;
- `"own"` — its JS form is a recognized *pattern*, not syntax.

`"Number"` is not an exception: it is spelled exactly as the JS built-in
it denotes.

Symbol tags never collide with word tags, so both live in one namespace.

### Operators

**Arity distinguishes unary from binary**: `["-", a]` is negation and
`["-", a, b]` is subtraction — the same overloading JS itself uses, and
unambiguous because no JS operator has two different meanings at the
same arity.

|Symbols|Arity|JS|Lazy|Notes|
|-------|-----|--|----|-----|
|`+` `-`|1|`+a`, `-a`|no|`+` is also the coercion [property-accessor](../spec/todo/2330-property-accessor.md) requires before a run-time index|
|`!` `~`|1|`!a`, `~a`|no|unary only|
|`+` `-` `*` `/` `%` `**`|2|`a + b`|no|arithmetic|
|`===` `!==` `<` `<=` `>` `>=`|2|`a === b`|no|`==` and `!=` are not allowed by [operators](../spec/todo/2340-operators.md)|
|`&` `\|` `^` `<<` `>>` `>>>`|2|`a & b`|no|bitwise|
|`&&` `\|\|` `??`|2|`a && b`|**yes**|the right operand is established only if the left does not decide the result|
|`?:`|3|`c ? t : e`|**yes**|exactly one of the two arms is established|

All operators are post-stage-1: stage 1 has no operators at all.

### Other operations

|Form|JS|Stage|Notes|
|----|--|-----|-----|
|`["throw", node]`|`throw v`|later|always fails; never produces a value|
|`["self"]`|—|later|the function itself; recursion is `["()", ["self"], args]`|
|`["frame"]`|—|later|the captured-consts frame, an array — as `["args"]` is for arguments|

**`["frame"]` and the closed-scope model.** A closure's free values are
copied into a frame when the function object is created — the scheme
[function-frame](../spec/todo/3111-function-frame.md) chooses — and
`["frame"]` is that array. It needs no accessor of its own: a slot is
ordinary indexing, `[".", ["frame"], 0]`, exactly as an argument is
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
  ([function](../spec/todo/3110-function.md) has exactly this example)
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
  (`arguments.callee` is forbidden in strict mode). `toString(f)` can
  print a *named function expression* — `function self(…) { … self(…) … }`
  — which round-trips, unlike the `throw` case.
- **Useless before `"?:"`**: with no branch there is no base case, so
  every `["self"]` call diverges. It lands with the operators, and
  before [let](../spec/todo/3220-let.md) (subject 11) — recursion is the
  baseline that `let` exists to make cheap on engines without TCO.

`throw` keeps a word tag because JS spells it as a **statement**, not an
expression — there is no operator symbol to reuse. Consequences:

- **Assertions become expressible in the EDAG**:
  `["?:", cond, undefined, ["throw", …]]`. This matters more than
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
- **`toString(f)` wrinkle**: since `throw` is a statement, a `throw`
  node inside an expression has no direct JS spelling. Printing it needs
  a wrapper — `(() => { throw v })()` — which round-trips but is the
  first operation whose printed form is not the syntax it came from.
  Alternatives (a recognized `throw` helper, or an expression-level
  `throw` pattern in the source language) to settle when the source
  syntax for assertions is specified.

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
[",", ["?:", ok, undefined, ["throw", e]], v]   // guard, then result
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

## Assumptions

Different graph-building rules follow from which of these assumptions are
accepted or rejected. Enumerated first, analyzed separately; each ends as
**accepted** or **rejected**, and the graph-building rules in the subjects
are then derived from the accepted set.

### A1. No side effects

**Status:** accepted

Code and functions don't have side effects: executing the same function
with the same parameters always produces the same result. This is FS
principle 1 ([spec/README.md](../spec/README.md)); with A2, "same result"
applies to runs that complete.

### A2. The runner may interrupt

**Status:** accepted

A runner has the right to interrupt a function if it consumes too many
resources or takes too much time to compute. No specific memory or time
limits are part of the specification.

Resource limits are a property of the **engine**, not of the function:
where one engine interrupts, another engine with more resources may
return a result or throw the semantics-mandated exception (A3). The
semantics defines one ideal outcome per input; every engine is a partial
realization of it. Engines may differ in *whether* they answer; for
*what* they answer, agreement is tiered:

- **Content-addressable engines (CAVM) with the same version of function
  serialization and identities MUST return the same result** — across
  engines and across runs (A1 gives this within one engine).
- Results of non-CA engines may vary in some cases: the observations
  that touch identity or function serialization (object/function
  identity, identity-based ordering —
  [object-identity](../spec/todo/object-identity.md) — and
  `toString(f)` text), which non-CA engines realize by references and
  run history rather than by content. The exact list of such cases is to
  be enumerated; identity-free observations agree on all engines.

Consequently FS code cannot rely on interruption or on its absence, and
an interrupt is observably the same opaque failure as any other (A4
contract).

### A3. Throws are preserved

**Status:** accepted

If a function **always** throws in JavaScript for the same parameters,
it must also **always** throw (fail) in FunctionalScript with the same
parameters.

"Always" scopes both sides to determinism-by-semantics: covered are the
throws the language mandates (e.g. `null[0]` fails on every run);
excluded are engine-dependent failures (stack-overflow depth,
out-of-memory), which ECMAScript does not pin down — those fall under
A2's interrupt freedom instead. Together with FS principle 2: when JS
always completes with a value, an uninterrupted FS run completes with
that value — so for spec-deterministic behavior, FS fails iff JS throws
or the runner interrupts (A2).

### A4. Computation order is preserved

**Status:** rejected — replaced by the opaque-error contract

Preserving observable computation order would forbid rearranging the
graph (for canonical hashing) and most optimization. Rejection is sound
only given A1 and only under the following contract.

**Opaque-error contract.** For every input, a function's observable
outcome is either its JS value or one indistinguishable "unexpected
error":

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

## Subjects

### 1. Structure: indices vs. nesting vs. references

**Status:** decided (revised)

**Resolution: the EDAG is a DAG of operation nodes connected by real
references; there is no index space and no normal form — the EDAG mirrors
the source structure and the hash takes it as written.**

History: this subject was first decided as "flat sequence with
`["local", index]` references plus nesting, mirroring the source". The
reference model replaces the index space entirely — the host language
already has references, so the EDAG should not invent an index scheme on
top of them ([DESIGN.md §8](../DESIGN.md) taken to its logical end). The
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
- **The EDAG is the single input to multiple processors**: the bytecode
  interpreter, the `toString(f)` source printer (shared nodes print as
  `const` lines, anonymous operands as expressions), and AOT backends
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

### 2. Arguments reference

**Status:** decided

**Resolution: a zero-parameter `["args"]` command yields the array of
arguments passed to the function.**

- The arguments array is first-class and always an array — the actual
  arguments the caller passed, whatever the declaration looked like.
  Missing arguments read as `undefined` via ordinary array indexing; extra
  arguments are simply present; forwarding is `["()", f, ["args"]]` —
  all ordinary array semantics, matching JS.
- Declared parameters are a compiler-side naming convention over the
  arguments array, not an EDAG concept; declared arity matters only for
  `.length` and `toString(f)` fidelity (subject 7).
- The rejected `["arg", i]` (single-argument access, no reified array)
  cannot express rest parameters (`(...xs) => xs`) or forwarding;
  `["arg", i]` is expressible as `[".", ["args"], i]` while the reverse
  is not.

Examples — named parameters are positions in the arguments array; the
compiler erases names:

```js
const f = (...a) => a[5]   // [".", ["args"], 5]
const g = (a) => a[5]      // [".", [".", ["args"], 0], 5]
```

### 3. Lazy operators and the branch extension path

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

### 4. Object constructor: key order and duplicate keys

**Status:** decided

**Resolution: property order is semantic** — the written key order is
part of the constructed *value*, not of the schedule: JS objects
preserve insertion order (`Object.keys`, iteration, `JSON.stringify`),
so reordering an object constructor's keys changes the resulting
object. This holds with A4 rejected — the evaluation *order* of
property operands is as free as any other (subject 8); what is fixed is
the result. Sorted-key canonicalization (as `fjs compile` applies to
data output, [spec/README.md](../spec/README.md)) must **not** be
applied to object constructors. Duplicate keys are a validation error.

### 5. Validation

**Status:** open (list agreed in direction, details when the RTTI schema
is written)

The EDAG is the `Function` constructor's public input and will see shapes
the FJS compiler would never emit. To validate:

- constants: function values in constant position are a validation error
  (until a `["=>", ...]` node exists,
  [function](../spec/todo/3110-function.md));
- the body: a single operation node;
- `","` (when introduced): at least two operands — a single-operand
  `","` is the identity and non-canonical; an assert operand reachable
  from another operand of the same `","` is redundant (well-formedness,
  subject 8);
- unknown command tags: validation error;
- **property operands** of `"."` and `".()"`: a permitted string
  constant, a number constant, or a `"+"` / `"Number"` node — anything
  else is a validation error, which is what keeps computed-string
  prototype access unrepresentable ([Operations](#operations)). The
  prohibited-name list comes from
  [property-accessor](../spec/todo/2330-property-accessor.md), and
  because the key is a *constant* the check happens once, at
  construction, not on every access;
- duplicate object-constructor keys: validation error (subject 4);
- **acyclicity**: DJS cannot express cycles (const-before-use), but an
  `Any` handed to the `Function` constructor can be built by other means —
  cyclic node graphs must be rejected;
- aliasing is *not* an error anywhere — referencing the same node from
  many positions is the sharing mechanism (subject 1).

### 6. Command vocabulary vs. the existing spec names

**Status:** decided

[property-accessor](../spec/todo/2330-property-accessor.md) names five
commands: `at`, `at_call`, `instance_property`, `instance_method_call`,
`own_property`. The EDAG keeps the general layer only — `"."` = its
`at`, `".()"` = its `at_call`, `["own", …]` = its `own_property` — while
`instance_property` and `instance_method_call` stay compile-time
specializations for the bytecode, where performance distinctions belong
([serialization](../spec/todo/serialization.md)).

An earlier draft added: "consequence — the EDAG interpreter carries the
safety burden 2330 assigns to compile-time checks; prohibited names must
be rejected at *runtime*". That no longer holds. The property operand is
restricted syntactically ([Operations](#operations)), so a prohibited
name is a **validation** error at construction, and a computed string
never reaches `"."` at all.

**Decided for the structural tags: they are JS syntax too** —
`[".", object, property]`, `["()", object, args]`,
`[".()", object, property, args]`, `[",", …]`. Syntax is as much a host
spelling as an operator symbol is, and `".()"` reads as the `o.p(…)` it
denotes. This supersedes the `at` / `call` / `bindCall` names used
earlier in this document.

**Decided: `"."` and `".()"`, not `"[]"` and `"[]()"`.** `"."` is the
shorter and more readable tag, and `".()"` composes to read exactly like
the method call it is.

**Decided: the EDAG keeps three access operations, not one and not
2330's five.** An earlier draft of this subject said `"."` was a single
operation covering every access, with 2330's distinctions left to the
bytecode. That was wrong — the distinction is a *safety* boundary, not
an optimization:

|EDAG|2330|key|
|---|----|---|
|`[".", o, p]`|`instance_property` + `at`|string constant (permitted), or a number|
|`[".()", o, p, args]`|`instance_method_call` + `at_call`|same|
|`["own", o, k]`|`own_property`|any computed string; own properties only|

`"."` merges 2330's static-name and numeric-index commands because the
operand restriction ([Operations](#operations)) covers both safely; the
static/numeric split that remains is a bytecode specialization, as
option 2 said. But `own_property` cannot be folded in: it is what makes
computed-string access *possible at all*, precisely by skipping the
prototype chain.

**Decided: the array constructor is `"[]"`.** Choosing `"."` for access
freed the tag, and `[a, b]` is precisely how JS spells an array literal.
The earlier objection — that `["[]", a, b]` would read as both a
two-element array and `a[b]` — disappeared with access moved to `"."`.
Word tags now survive only where JS genuinely has no expression
spelling: `"args"`, `"frame"`, `"self"`, `"throw"`.

### 7. Top-level shape of a function

**Status:** open

With the body a single operation node, no special top-level shape
remains — every position, the body included, is a node, and the body
composes directly into `["=>", frame, body]`
([Operations](#operations)).

To decide: whether stage 1's `Function` constructor input is the bare
body node or a wrapper carrying metadata — parameter count for
`.length`, and parameter-shape fidelity for `toString(f)` (subject 2
erases names and arity; without a wrapper, `toString` can only print a
rest-parameter spelling).

### 8. `","`: anchored evaluation

**Status:** decided (revised: the merge is the `","` operation)

**Resolution: non-resulting computations are merged into the graph by
the `","` operation — `[",", ...asserts, result]`, the JS comma
operator — which guarantees *membership*, not order.** Stage 1 ships
without `","`; these rules bind the operation when it is introduced.

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
  *expected* outcome and belongs in values (`Result` / `Nullable`,
  [044-error-handling-pattern](./044-error-handling-pattern.md)); an
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

### 9. Canonical graph serialization and hashing

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
  identical constructor nodes: `[{}, {}]` and `const x = {}; [x, x]` are
  semantically different, and a naive structural hash conflates them. The
  hash must be computed over the canonical graph serialization.
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
### 10. Free variables: module consts, imports, built-ins

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
([DESIGN.md §2](../DESIGN.md)), and nothing here is load-bearing for
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

The EDAG's only leaves are constants and `["args"]`. Nothing references a
name the function did not compute itself:

- a module-level `const` or `import` the body uses
  ([const](../spec/2120-const.md),
  [default-import](../spec/2130-default-import.md));
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


### 11. `let`, loops, and tail calls

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

### 12. `toString(f)`: real, runnable source

**Status:** open (requirement agreed; details to settle)

`toString(f)` returns **real FunctionalScript source** — a JS engine can
`eval` it and get an equivalent function. Not a debug rendering: the
printed text is the function.

(`eval` itself remains *not allowed inside FS*
([built-in](../spec/todo/2360-built-in.md)). This is a capability of the
host holding the source, not of FS code.)

What that requires of the printer:

- **Every operation needs an expression form.** The two operations with
  no JS expression spelling need runnable workarounds, not
  approximations: `["throw", v]` prints as `(() => { throw v })()`, and
  a function using `["self"]` prints as a *named function expression*,
  `function self(…) { … self(…) … }`. Both `eval` correctly.
- **Sharing must be preserved.** A node referenced twice must print as
  one `const` used twice, never as two copies: `[x, x]` and `[{}, {}]`
  are different functions (subject 1). This is the same graph-flattening
  hazard as JSON output ([spec/README.md](../spec/README.md)) — a
  printer that expands sharing silently changes semantics.
- **The printed source must be closed.** `eval` has no module scope, so
  nothing may print as a bare imported or module-level name; captured
  values are materialized in the text. This is exactly what the
  closed-scope model gives ([Operations](#operations)): the only leaves
  to render are constants, `["args"]`, `["frame"]` and `["self"]`.
- **The same `const` mechanism carries frames.** A printed `const` is
  not only how sharing is preserved — it is also how a captured value
  reaches a nested function: the value is bound in the enclosing scope
  and the inner arrow refers to it by name.

  ```js
  const c0 = /* frame element */
  const b = y => /* … c0 … */          // ["frame"] slot 0 reads as c0
  ```

  So **the EDAG's explicit frame is JS's implicit lexical capture**:
  printing turns frame slots into captured names, parsing turns captured
  names back into frame slots. `["frame"]` used as a whole array (rather
  than indexed) simply prints as a real array of those names.

  This sharpens subject 10's canonicality question: the printed `const`
  order determines the frame layout recovered on parse, so printer and
  parser must agree on layout or the round-trip below changes the hash.
- **Printing is recursive over values.** A captured *function* value
  prints as its own source; every other DJS value has a literal
  spelling, so the value domain is closed under printing.

The property worth aiming at: **parse(toString(f)) reproduces the same
EDAG**, and therefore the same hash (subject 9). That is what makes
`toString` trustworthy rather than merely informative — and it is a
sharper test of the whole design than any single operation, since it
fails the moment an operation has no faithful source form.

Open: whether the printed form is *canonical* (one function, one text)
or merely correct. Canonical printing would make `toString` a
serialization format in its own right; it also demands the same
normalization decisions parked in subjects 1 and 9.

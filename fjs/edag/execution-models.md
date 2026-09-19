# EDAG execution models

EDAG can be executed under different identity and memoization models. They are
not just progressively faster implementations. The strategies in
[§2](#2-js-compatible-execution) share one allocation/identity contract;
Amnesia, global memoization and CAVM use the distinct models below. None grants
an unspecified exception merely because an executor is not content-addressable.

The table describes **identity compatibility**. The
[language principles](../../spec/README.md#principles) separately define
indistinguishable failures and the adopted
[function-text exception](../../spec/README.md#function-source-representation-exception).
Within the same declared identity and rendering contract, successful observations
must agree. Resource limits may differ; A2's interruption freedom in the stage-1
discussion does not authorize a different successful answer.

| model | reuse | JavaScript identity-compatible |
|---|---|---|
| [Amnesia](#1-amnesia) | none | no |
| [JS-compatible](#2-js-compatible-execution) | node identity, per function invocation | yes |
| [Global memoization](#3-global-memoization) | node identity, across invocations | no |
| [Content-addressable VM](#4-content-addressable-vm) | content identity | no |

## 1. Amnesia

[Amnesia](amnesia/README.md) is a tree-walking evaluator. It remembers no node
values: every incoming edge evaluates its target again.

```js
const shared = ['[]', [1, 2]]
vm(context)(['===', shared, shared]) // false
```

The EDAG node is shared, but Amnesia creates two arrays. This deliberately does
not implement EDAG/JavaScript identity semantics; its purpose is to provide the
simplest evaluator for semantic proofs.

## 2. JS-compatible execution

A JavaScript-compatible executor memoizes by **node identity within one function
invocation**. A shared node evaluates once during that invocation, while the
next call starts with fresh values. This preserves observable allocation and
identity semantics.

There are several implementation strategies. **They preserve the same observable
allocation and sharing behavior**, including through subsequent calls. The
function-text exception is independent: FJS VM rendering uses associated EDAG,
while ordinary generated JavaScript retains its host representation unless an
FJS runtime implements the VM rendering contract. This does not change `.length`,
allocation identity, or non-function string conversion. The
[serializer/frame/`self` questions](../../spec/todo/serialization.md#function-text-and-serialization)
and conditional lazy-rendering requirement remain open/conditional as recorded
there; the strategies below do not decide them.

### 2.1 Memoize every node

Keep a per-invocation memo table or frame slot for every computation. This is the
simplest correct implementation, but it can retain many values that are never
reused.

### 2.2 Analyze and memoize only shared nodes

Traverse the function graph before execution, identify nodes whose values must
be reused, and allocate memoization only for them. Nodes reached once can be
computed directly.

This preserves the behavior of §2.1 while reducing runtime memory and memo-table
work. The traversal is [`analysis`](./analysis/module.f.mjs): one table per
program, the shared entries by index, each cached within its scope; the
executor over it is [`memo`](./memo/module.f.mjs), one slot per shared entry
of an invocation, filled on first demand.

### 2.3 Generate JavaScript

Traverse the graph and generate ordinary JavaScript. Shared EDAG nodes become
local bindings where necessary, so the host JavaScript engine provides the same
per-invocation identity behavior.

Conceptually, a shared object is emitted as:

```js
const a = []
return [a, a]
```

rather than:

```js
return [[], []]
```

This preserves the allocation/identity semantics of §2.1 and §2.2 while
delegating execution and optimization to the JavaScript engine. Its host's
function text can differ under the adopted exception; generating JavaScript
does not by itself implement the FJS VM's function renderer.

## 3. Global memoization

Global memoization keeps results beyond a function invocation. Reuse is still
based on the identity of a particular EDAG node, but a context-independent node
can be evaluated once and reused by later calls.

For example:

```js
const f = () => {
    const a = { b: 2 + 2 }
    return a.b
}
```

A global-memoizing executor can compute the context-independent result once and
reduce the program effectively to:

```js
const f = () => 4
```

The reduced graph can be serialized back to a standalone program file, like a
compiler output; persistence does not require storing the program in CAS.

Unlike §2, this is a different identity model. Reusing an allocated object
across calls can make two values identical where JavaScript would allocate two
objects. Global memoization therefore permits reductions that are not generally
JavaScript-semantics-preserving.

It also has a limit: reuse follows existing **node identity**. Two independently
represented nodes with identical computations are still different nodes.

## 4. Content-addressable VM

A content-addressable VM (CAVM) uses **content identity**, not merely existing
node identity. Identical closed computation graphs resolve to the same content,
even when they occur independently or in different functions.

For example:

```js
const a = { b: 2 + 2 }
const b = { b: 2 + 2 }
```

A CAVM can represent both initializers as one content-addressed graph. This
structural deduplication requires no execution: loading the EDAG into the CAVM
and immediately serializing it back can already produce a deduplicated program.
Execution can reduce it further by replacing computations with their results.

The same applies across function boundaries when the complete computation and
its dependencies have identical content. CAVM reuse is therefore stronger than
global memoization:

```text
Global memoization: same node       -> same stored result
CAVM:               same content    -> same canonical computation/value
```

That stronger model can produce a more reduced serialized program, but it can
also change observable behavior relative to JavaScript. Content-equivalent
objects may become one canonical object, so allocation identity is no longer the
JavaScript identity model.

A full implementation also needs a runtime designed to discover and resolve
content identity cheaply. Emulating canonical content-addressed values on top of
a normal JavaScript engine requires hashing, lookup tables, canonicalization,
and extra retained metadata, which can be complex, slow, and memory-intensive.
A specialized CAVM can instead make content identity part of its native value
representation. See [the CAVM design TODO](../../spec/todo/content-addressable-vm.md).

## Boundary

The key architectural boundary is between **implementation strategies** and
**semantic models**:

- §2.1, §2.2, and §2.3 implement the same JavaScript-compatible allocation and
  sharing semantics. Their separate function-text boundary is stated in §2.
- Amnesia, global memoization, and CAVM intentionally have different identity
  semantics and therefore need separate behavioral expectations.

## Transformations

An EDAG is transformed on its way through the toolchain: written to `.f.js`
and compiled back
([`fjs/fsc/serializer`](../fsc/serializer/module.f.mjs)),
loaded into a CAVM and serialized back, reduced by a global memoizer. Three
requirements say what a transformation may change.

1. **A round trip preserves the number of computations.** After
   `.f.js` → EDAG → `.f.js` → EDAG, every computation a program can observe
   — a call, a constructor, anything that mints identity — happens as many
   times under the JS-compatible model as in the original program, unless a
   function or an expression throws; then only the throw is promised, not
   which of two failing computations fails first. This is why the writer
   spells a shared identity-minting node as one `const` and never
   duplicates a call. A pure node — an access, an operator, `is` — mints
   nothing and no program can count it, so the analysis may merge two into
   one and the writer may spell one at each use
   ([`todo/analysis.md`](./todo/analysis.md)).

2. **A CAVM-optimized EDAG need not be expressible in `.f.js`.** A CAVM may
   reduce many calls of one content to a few in the EDAG. `.f.js` shares a
   value only through a `const`, which evaluates once, eagerly, in its
   scope: a merged call the program reaches in eager positions of one scope
   is spelled as that `const` and keeps the CAVM's count, but a merged call
   the program reaches only through lazy edges — `[a && x(), b && x()]`
   merged into one node — has no spelling that computes it once and only
   when the program would. A `const` would compute it when the program
   would not, and the alternative duplicates the call, which restores the
   original count on a non-CAVM path. So there are valid EDAGs, a CAVM's
   output among them, that `.f.js` cannot express without duplicating
   calls; the writer refuses the lazy-edge case by name, and the round trip
   of requirement 1 is promised for the graphs the compiler emits, not for
   them. Merging never crosses a `=>` boundary: a node shared across
   function bodies is not a valid EDAG
   ([README](./README.md), identity-dependent canonicality), so a CAVM
   keeps content identity across bodies in its own representation and
   serializes one node per body.

3. **Reuse follows the selected identity model.** A CAVM resolves equal
   content to one value; a global memoizer reuses a context-independent result
   across invocations. Such reuse can change `===`, `!==` and the results of
   computations depending on them relative to JavaScript allocations. Those
   differences belong to §3 and §4, not to every non-CAVM executor. A §2
   executor may cache or reduce only while preserving its observable allocation
   and sharing contract. Amnesia's repeated evaluation of shared nodes is its
   deliberate §1 behavior, not a permitted §2 strategy. The approved
   function-text exception remains separate from all of these identity choices.

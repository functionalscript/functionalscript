# EDAG execution models

EDAG can be executed under different identity and memoization models. They are
not just progressively faster implementations: only the implementations in
[§2](#2-js-compatible-execution) are required to have identical observable
behavior.

| model | reuse | JavaScript-compatible |
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

There are several implementation strategies. **They must all behave the same;
only speed and memory use may differ.**

### 2.1 Memoize every node

Keep a per-invocation memo table or frame slot for every computation. This is the
simplest correct implementation, but it can retain many values that are never
reused.

### 2.2 Analyze and memoize only shared nodes

Traverse the function graph before execution, identify nodes whose values must
be reused, and allocate memoization only for them. Nodes reached once can be
computed directly.

This preserves the behavior of §2.1 while reducing runtime memory and memo-table
work.

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

This has the same observable semantics as §2.1 and §2.2, but delegates most
execution and optimization to the JavaScript engine.

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

- §2.1, §2.2, and §2.3 are interchangeable implementations of the same
  JavaScript-compatible EDAG semantics.
- Amnesia, global memoization, and CAVM intentionally have different identity
  semantics and therefore need separate behavioral expectations.

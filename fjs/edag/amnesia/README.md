# Amnesia

A tree-walking evaluator for [`exp`](../module.f.mjs) — the first thing in the
repository that *executes* an EDAG rather than describing one.

It exists so that proofs can state what a node means by evaluating it. That is
its whole job. **It is not a VM for FunctionalScript, and nothing that matters
should run on it.** The sections below are the reasons, and they are not a
to-do list: this module is not on the way to becoming the real executor.

## What it is for

[`../proof.f.mjs`](../proof.f.mjs) pins what the schema *accepts* — shape, not
meaning. Two of its sections, `ownJs` and `chainsJs`, have to run **JavaScript**
to pin the behavior the nodes are built around, because until this module
existed nothing could run an EDAG. Its own [`proof.f.mjs`](./proof.f.mjs) is
what that gap was waiting for: `['+', 2, 3]` is `5` and
`['&&', false, ['.', null, 'x']]` short-circuits are now claims a test makes by
evaluating the node, not by evaluating the JavaScript it was modeled on.

## Why it is not a VM

### It forgets — hence the name

The model memoizes every node by identity within one invocation, so a shared
node evaluates **once** and sharing is observable
([`../README.md`](../README.md)). This evaluator re-walks a shared subgraph once
per incoming edge, and that is not a performance footnote:

```js
const shared = ['[]', [1, 2]]
vm(context)(['===', shared, shared])   // false — the model says true
```

One node reached from two operand positions is one value; here it is two
arrays, so identity comparisons silently give the wrong answer. The cost
compounds in the same way. A chain of 22 shared additions,
`['+', x, x]` over the same `x`, is 23 distinct nodes:

| | node evaluations |
|---|---|
| memoized, as specified | 23 |
| here | 8,388,607 (~0.3 s) |

Exponential in depth, and the leaf alone is visited 4,194,304 times.
[`validate`](../../types/rtti/validate/module.f.mjs) has the same flaw for the
same reason, which is where the word for it comes from. The models that do
preserve identity, and what each is for, are in
[execution-models.md](../execution-models.md).

### It hands out the host

`.` is `a[b]`, so the entire JavaScript prototype chain is reachable:

```js
vm(context)(['.', ['=>', ['[]', []], 1], 'constructor'])   // Function
vm(context)(['.', ['{}', []], '__proto__'])       // resolves
```

[`spec/todo/2360-built-in.md`](../../../spec/todo/2360-built-in.md) lists both
under **Prohibited Properties** — `constructor` because
`(() => null).constructor('a', 'return a * a')` builds a function out of a
string, which is arbitrary code inside a pure subset. A real executor resolves
a property as *own, else a curated standard-library table*, so the reachable
surface is exactly what the table lists. This one delegates to the host, so
anything it runs has the host's authority. `own` is unaffected — it reads the
own descriptor and never walks the chain.

### It checks nothing about the graph

`validate` is shape validation, so the identity-dependent rules go unchecked
here as well:

- **Acyclicity.** A cyclic graph overflows the stack instead of being rejected.
- **The closed-scope rule** — an operation-node identity may be shared within
  one function's scope but never across a `=>` boundary. A graph that breaks it
  evaluates anyway, with `['args']` meaning whichever scope happened to reach
  it.

### It inherits the host where the specification does not

Engines disagree about the corners this evaluator delegates: `(u?.b)(d)` on a
nullish `u` throws under V8 and evaluates to `undefined` under JavaScriptCore,
and the specification follows V8 (["Chains"](../README.md#chains)). Whatever
the host does is what you get. A real executor produces the specified answer on
every host — and NaNVM has no JavaScript prototype chain to delegate to at all.

## Not implemented

`?.`, `?.()`, and a non-empty `lambdas` operand on `()` are `todo`, so no
chain steps, no receiver, and no optional short-circuiting. `['self']` is not
in the schema yet, so a function reaches itself only by being passed as an
argument.

## Where the real one goes

The executor of record is NaNVM's bytecode interpreter —
[`spec/todo/3111-function-frame.md`](../../../spec/todo/3111-function-frame.md)
for frames and calls,
[`spec/todo/content-addressable-vm.md`](../../../spec/todo/content-addressable-vm.md)
for addressing. Being in Rust, it has neither a JavaScript prototype chain to
borrow nor a reason to skip memoization, which is why both defects above are
this module's alone and not a staging decision.

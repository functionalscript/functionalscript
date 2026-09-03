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
`['&&', false, ['.', null, 'x']]` short-circuits are now claims a test
makes by evaluating the node, not by evaluating the JavaScript it was modeled
on.

## Why it is not a VM

### It trusts its host

Every node and step is read by **destructuring** (`const [o, e, cont] = k`),
which is what lets a chain end by arity: the array iterator stops at `length`,
so an absent continuation reads as `undefined` rather than as whatever a
prototype supplies at that index — an indexed `k[2]` would read the prototype,
which is why none appears.

That choice is not a hardening claim, and no read style would be one. This
evaluator's guarantees assume what the language itself can build: a DJS value
on a pristine host, where every read style coincides — `fjs/AGENTS.md` §3.1
"One realm, one prototype chain" is the rule, and keeping anything else out is
the host boundary's job. That is one more reason this is not a VM, and nothing
that matters should run on it.

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
[`validate`](../../rtti/validate/module.f.mjs) has the same flaw for the
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

`.`, the operators, and every method the prototype chain above reaches are the
host's, so what a host does is what you get — down to the type and the text of
the errors a case under a `throw` key observes.

One corner where that would have been wrong is interpreted here instead. When
`u` is nullish, `(u?.b)(d)` must throw: the parentheses end the optional
chain, so `undefined` is what gets called. V8 does throw; JavaScriptCore
(hence `bun test`) carries the short-circuit through the parentheses and
evaluates to `undefined` (["Chains"](../README.md#chains), tracked in
[bun-optional-chain-parentheses.md](../../../todo/blocked/bun-optional-chain-parentheses.md)).
That spelling is
a `|!()` step, and `skip` in [module.f.mjs](./module.f.mjs) is what carries
it: a short-circuited region drops every step it meets except that one, which
runs on the `undefined` the region produced. So the specified answer comes out
on every host — which is why [`proof.f.mjs`](./proof.f.mjs) can state that case
at all, where the
JavaScript of `../proof.f.mjs`'s `chainsJs` has to leave it out. A real
executor does the same for everything above, and NaNVM has no JavaScript
prototype chain to delegate to in the first place.

## Not implemented

Every node in the schema now evaluates. The three chain nodes that own a
continuation walk it with one function per lambda type — `propertyLambda`,
`optionLambda`, `optionPropertyLambda` — and a short-circuited region is the
single `skip`, shared by all three, whose one exception is the `|!()` step the
parentheses put outside the region (["Chains"](../README.md#chains)).
`['self']` is not in the schema yet, so a function reaches itself only by being
passed as an argument.

## Where the real one goes

The executor of record is NaNVM's bytecode interpreter —
[`spec/todo/3111-function-frame.md`](../../../spec/todo/3111-function-frame.md)
for frames and calls,
[`spec/todo/content-addressable-vm.md`](../../../spec/todo/content-addressable-vm.md)
for addressing. Being in Rust, it has neither a JavaScript prototype chain to
borrow nor a reason to skip memoization, which is why both defects above are
this module's alone and not a staging decision.

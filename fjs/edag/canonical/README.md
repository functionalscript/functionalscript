# Canonical

The chain conditions [`validate`](../../types/rtti/validate/module.f.mjs)
cannot state, as a pass over a whole graph.

A `lambdas` is `array(lambda)`, and neither `array(T)` nor `or` says anything
about cardinality or order. So the three conditions that bound the two walkers
— `_` and `_()` in [`../module.f.mjs`](../module.f.mjs) — have nowhere to live
in the schema, and live here instead. A graph is a legal EDAG when
`validate(exp)` accepts its shape **and** `canonical` accepts its chains;
neither implies the other.

## Why a graph needs them at all

There is no normal form for `exp` ([`../README.md`](../README.md)) — a
function's hash is its graph as written. That is a claim about the whole
model, and it does not say every node kind may be spelled several ways: what
`_` and `_()` add is a *second* spelling of expressions the pure nodes already
spell, and sharing is observable, so the two spellings are not equally good.
A step is not an `exp`: it cannot be shared, cannot be substituted for an
equivalent expression, and contributes no hash of its own. A walker that
swallows a subexpression the pure nodes could have held therefore hides it
where nothing can share it, and it is evaluated again wherever it recurs.

So the conditions are not tidiness, and not canonicality creeping in through
the back door. They are the price of the walkers existing at all: every pure
node the partition adds is one more spelling the walkers must be forbidden to
duplicate.

## The conditions

1. **Cardinality.** `_` holds at least two steps, `_()` at least one. Without
   this a walker respells a pure node — `['_', a, [['|.', b]]]` respells
   `a.b`. The other half of the condition, at least one optional step, is not
   a test of its own: it follows from the front cut, which passes only when
   the first step is optional or the second one is.
2. **Minimality**, the shortest valid form: where an expression can be split
   into two, it is split. The walk is cut at **every** available cut point,
   and cuts come in three places — before the region, inside it, and at the
   far end of a `_()`. See [Chains](../README.md#chains) for what each cut is
   and why closing the region there is unobservable.

Cardinality alone is the rejected design, not a lighter option: it admits four
families of graphs that duplicate a shorter spelling exactly, error text
included. [`proof.f.mjs`](./proof.f.mjs) carries each of them, with the
spelling it loses to named beside it.

## What it is not

- **Not a rewriter.** It says a graph is not minimal; it does not produce the
  minimal one. Emitting the shortest form is the lowering's job —
  [compile-modules-to-edag.md](../../djs/todo/compile-modules-to-edag.md).
  Rewriting here would mean rebuilding containers, which loses the sharing an
  EDAG exists to carry, for the same reason `parse` cannot canonicalize one
  ([identity-aware-parse.md](../../types/rtti/todo/identity-aware-parse.md)).
- **Not a reader of the open tail.** Tuples are open
  ([Caveats](../README.md#caveats)), so an element past a node's declared
  arity is data the node never evaluates. `validate` ignores it and so does
  this: `['args', x]` is a valid `['args']` whatever `x` is, and a pass that
  walked `x` would reject a runtime-valid graph for what its ignored tail
  happens to hold.
- **Not a shape check.** It assumes a graph `validate(exp)` already accepts,
  which is what makes reading declared positions safe.
- **Not identity-aware**, like `validate`: a shared subgraph is walked once
  per incoming edge, so cost is exponential in depth and a cycle overflows the
  stack rather than being rejected.
- **Not a check of anything but chains.** Acyclicity and the closed-scope rule
  are still unchecked, and still tracked in
  [`../README.md`](../README.md)'s caveats.

## The other way to do it

Stating the conditions structurally instead — replacing `Lambdas` with one
lambda type per chain state, so the wrong shapes stop being expressible rather
than being rejected — is [chain-node-grammar.md](../todo/chain-node-grammar.md).
It would make this module unnecessary; until it settles, the rule has to be
enforced somewhere, and enforcing it is what this is.

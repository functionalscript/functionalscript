# Eff — an experiment, not a settled design

`Eff` is a fluent, method-chaining wrapper over the raw `Effect` from
[`../module.f.ts`](../module.f.ts). **It is under active investigation and its
design is unstable.** Expect the shape to change between releases, and expect
it to be a real possibility that it is removed entirely.

This is deliberate. The question it exists to answer — is a chaining wrapper
worth having at all, and in what shape — cannot be settled by discussion. It
needs data from real call sites, gathered over several revisions.

## `Effect` is stable; `Eff` is not

The two layers have opposite stability guarantees, and it is worth being
explicit about which is which.

The raw primitives — `Effect`, `step`, `decode`, and the combinators beside
them — have converged. They will keep gaining combinators, but the core is
unlikely to change much.

`Eff` sits on top and is expressible entirely in terms of `step`. The reverse
is not true: nothing in the primitive layer depends on this module. That
asymmetry is what makes the experiment safe to run — the wrapper can be
re-cut, reshaped, or deleted without any risk to the code underneath, because
every `Eff` chain has a mechanical raw-`step` equivalent.

Using `Eff` is therefore not discouraged. Using it *is* the experiment. Just
don't build on it expecting the API to hold still.

## What is being balanced

Ergonomics against performance — where performance means more than speed.

**Ergonomics.** JavaScript has no pipeline operator, so composing a sequence
leaves two options: name every intermediate (`const r0 = …; const r1 = …r0…`)
or route it through a helper. Named intermediates are free at runtime but
verbose, and they force a name onto steps that don't deserve one. A helper
reads better and costs something. Neither is obviously right, which is the
whole problem.

**Allocation.** FunctionalScript has no classes, so a wrapper's helper
functions are attached to each instance rather than shared on a prototype.
Every `.step()` builds a new object and its closures. There is no per-type
place to put them.

**Cost of the history.** `.step` carries every prior value forward, and each
link copies the accumulated tuple (`pure([r, ...tp])`). An n-link chain is
therefore O(n²) copies at runtime. Harmless for short chains, and recursive
loops that re-enter through a fresh `eff()` start from an empty history, so it
does not accumulate across recursion — but it is a cost the raw form does not
pay, and it should be measured rather than assumed negligible.

**Identity.** This is the subtlest one, and specific to this language. A
closed, module-scope function has a context-free identity, so content-addressed
FunctionalScript can deduplicate structurally identical functions across
modules and repositories; a function that captures enclosing locals hashes
uniquely to its context (see the hoisting rules in
[`AGENTS.md`](../../../AGENTS.md)). Both of `Eff`'s members capture the effect
they wrap, so **every instance is inherently un-shareable** — not merely an
allocation, but a value the content-addressed store can never dedupe. Any
wrapper of this shape pays that, so it is a property of the approach rather
than of this implementation.

## How the question gets decided

By conversion and comparison, over multiple pull requests.

Usage is currently split cleanly by file rather than mixed within one: `fjs/cas`,
`fjs/cas/evo`, and `fjs/emergent_testing` use `Eff`; most other effect code uses
raw `step`. That split is historical — those three simply were not converted
when `eff` was removed elsewhere — but it is useful anyway, because they are the
most effect-dense modules in the repository. Converting them is where the
wrapper should pay off most, and so is where the evidence will be clearest.

What is worth recording for each conversion: how many call sites changed, what
happened to nesting depth and indentation, whether intermediate names had to be
invented, and whether the value history was actually used or merely carried.

## Related open questions

`fn` in [`fjs/types/function`](../../types/function/module.f.ts) is the same
idea for plain functions, with the same unresolved trade-off. Whatever is
decided here should probably apply there too.

If ECMAScript ever ships a pipeline operator (`|>`), most of this becomes moot
— the ergonomic gap that motivates a wrapper closes, and the raw primitives
would be usable directly with no allocation, no history copying, and no
identity cost. That is a reason to keep the wrapper layer thin and disposable
rather than to invest in it heavily.

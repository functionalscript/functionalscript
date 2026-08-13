# Eff — an experiment, not a settled design

`Eff` is a fluent, method-chaining wrapper over the raw `Effect` from
[`../module.f.mjs`](../module.f.mjs). **It is under active investigation and its
design is unstable.** Expect the shape to change between releases, and expect
it to be a real possibility that it is removed entirely.

This is deliberate. The question it exists to answer — is a chaining wrapper
worth having at all, and in what shape — cannot be settled by discussion. It
needs data from real call sites, gathered over several revisions.

## `Effect` is stable; `Eff` is not

The two layers have opposite stability guarantees, and it is worth being
explicit about which is which.

The raw primitives — `Effect`, `step`, `match`, and the combinators beside
them — have converged. They will keep gaining combinators, but the core is
unlikely to change much.

`Eff` sits on top and is expressible entirely in terms of `step`. The reverse
is not true: nothing in the primitive layer depends on this module. That
asymmetry is what makes the experiment safe to run — the wrapper can be
re-cut, reshaped, or deleted without any risk to the code underneath, because
every `Eff` chain has a mechanical raw-`step` equivalent.

Using `Eff` is therefore not discouraged. Using it *is* the experiment. Just
don't build on it expecting the API to hold still.

## Assembly and high-level, with no compiler in between

Raw `step` with named intermediates is close to assembly: one operation per
line, every temporary explicitly named, nothing implicit. More precisely it is
SSA — the form compilers lower *to*, where each value is assigned exactly once
in evaluation order. `historyStep` fits the same register: a position in the
history is literally a de Bruijn index into the values still live at that point.

That is not a complaint about the low level. Assembly persists because it is
the level at which you can see exactly what happens, which is why the raw
primitives stay regardless of how this is decided. `Eff` is an attempt at the
other level — the ergonomics of a high-level language, where a sequence is
written as a composition instead of transcribed as a list of temporaries.

What is missing is the part that normally resolves the tension. In a language
with a compiler, a composition layer is a *zero-cost* abstraction: it exists in
the source and is erased before anything runs. Here nothing erases it. `Eff` is
not syntax that disappears; it is objects and closures that survive into the
runtime — allocated per instance, carrying a history tuple, holding an identity
that content addressing cannot share. The high-level prices are paid at
runtime, with no optimizer to reclaim them.

This is also why a pipeline operator would change the picture rather than
merely improve it. `|>` is syntax: parsed, erased, free by construction. A
pipeline helper is a value, and values cost. They are not the same solution at
different scales — they differ in kind.

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

`.value` adds a second, smaller cost of the same kind: because it is a plain
field rather than a method, each `.step` eagerly builds the projection that
drops the history tuple, whether or not that link is ever unwrapped. An n-link
chain builds n projections where a deferred method would build one. That is a
constant factor rather than a change in growth rate — no extra forcing of the
wrapped effect — and it is the price of `.value` never doing work when read.

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
[`AGENTS.md`](../../../AGENTS.md)). `Eff`'s `.step` is a closure over the chain
it continues, so **every instance is inherently un-shareable** — not merely an
allocation, but a value the content-addressed store can never dedupe. Any
wrapper of this shape pays that, so it is a property of the approach rather
than of this implementation.

## How the question gets decided

By conversion and comparison, over multiple pull requests.

**Nothing in the repository uses `Eff` today.** The last consumers — `fjs/cas`,
`fjs/cas/evo`, `fjs/emergent_testing`, and `fjs/protocol/mcp`'s proof — have
been converted to raw `step` / `mapStep` / `historyStep`, so this module and its
proof are all that remain. Those were the most effect-dense modules in the
repository, which is why they were where the wrapper should have paid off most
and where the evidence is clearest.

That is a pause, not a verdict. The wrapper stays available and stays cheap to
keep, for the reason given above: nothing in the primitive layer depends on it.

What the conversion recorded, in the terms this section asked for:

- **Call sites.** Every `eff(e).step(f).value` had a mechanical raw
  equivalent, so nothing had to be redesigned to lose the wrapper. A chain
  whose last link was a pure projection collapsed to a single `mapStep`,
  shorter than the fluent form it replaced.
- **Nesting and indentation.** Flat chains came out *less* indented: the
  `eff(…)` / `.value` bracketing costs a level the raw form does not pay. The
  chains that genuinely nested — `writeImpl` in `fjs/cas` — nested identically
  either way, because that nesting is forced by locals computed inside a
  continuation rather than by the spelling.
- **Intermediate names.** A handful had to be invented, and they read as
  documentation rather than ceremony (`listed`, `reported`, `total`). The raw
  form asks for one name per link; that is the SSA cost described above, and it
  bites only where a link has nothing worth calling it — `publish`'s
  `created` / `removed` / `stated` are three such names for what the fluent
  chain wrote as three anonymous `.step`s.
- **The history.** Mostly carried, not used. Only three chains read a prior
  value at all — `gcStage` (`fjs/cas`), `runModuleMap`
  (`fjs/emergent_testing`), and the state read-back in the MCP proof — and each
  became an explicit `historyStep` that says so where it happens. The fluent
  `.step` was paying for the history tuple on every link regardless.

What conversion cannot supply is the other half of the trade: what the wrapper
actually costs when a chain is long and hot. That needs a measurement, not
another rewrite.

## Related open questions

`fn` in [`fjs/types/function`](../../types/function/module.f.mjs) is the same
idea for plain functions, with the same unresolved trade-off. Whatever is
decided here should probably apply there too.

If ECMAScript ever ships a pipeline operator (`|>`), most of this becomes moot:
the ergonomic gap that motivates a wrapper closes, and — being syntax rather
than a value — it closes for free, with no allocation, no history copying, and
no identity cost. Any wrapper here is therefore a stand-in for missing syntax,
which is a reason to keep it thin and disposable rather than to invest in it
heavily.

## Investigate imports, promises and realms

**Priority:** P3
**Status:** on-hold

> **Scope.** In a browser this framework runs `.f.mjs` and nothing else; under
> `fjs t` it also runs a few impure `.mjs` proofs; and covering every edge case
> of plain JavaScript is not a goal. See
> [the README](../README.md#scope) — everything below is read under that rule.
> A `.f.mjs` that breaks it is a defect, not an exception — the one known case,
> two `Promise.resolve` fixtures in `../proof.f.mjs`, is fixed: neither promise
> was ever consumed, since the mocks intercept the effects and read the context
> as data.

### Problem

Three mechanisms meet in the runner, none of them is written down as a rule, and
the code where they meet reads as a pile of special cases rather than a design.
They are separate mechanisms that happen to interact, and the interaction is
what nobody has stated:

**A module namespace object is a thenable.** `import()` resolves by *adopting*
what a module exports, so a module exporting a function named `then` corrupts
its own dynamic import. That is why exporting `then` from a proof module is
forbidden ([`spec/todo/3240-export.md`](../../../spec/todo/3240-export.md)) —
but the rule lives in a spec issue and a README paragraph, and nothing checks
it. The proof discovery in `../../dev/module.f.mjs` imports whatever it finds.

**A proof tree is not a thenable, even when it has a `then`.** The runner's rule
is that only an actual `Promise` is an asynchronous value, so `{ then: f }`
returned from a proof is a sub-tree with a test called `then` in it. This is the
opposite reading of the same property name, one layer down, and both readings
are correct in their own layer. Nothing says so in one place.

**`instanceof Promise` is realm-local.** A promise built in an iframe, a worker
or a `node:vm` context is not `instanceof Promise` here, so under `fjs t` it is
walked as a proof tree and a *rejected* one is reported as a pass. The browser
runner used to defend against this with `Symbol.species` shadowing and an
intrinsic `then` — about 150 lines that read as a magic mess and were, at the
time, the only place the exposure was covered — and
[sharing the runners](share-browser-console-runner.md) forced the single answer
this section was written to demand. **It was answered knowingly**, in
functionalscript#1742: the machinery and its `species.proof.mjs` are gone, both
runners ask `instanceof Promise` in `effects/common`'s `sandbox`, and the
exposure below is now one exposure rather than a difference between two hosts.
The rest of this file is the study that decision was made from, and it stays
because the exposure did.

The three are usually discussed one at a time, which is why the interaction
keeps being rediscovered: the thing that makes a namespace dangerous (`then` is
adopted) is the thing the runner deliberately refuses to do (`then` is a name),
and the check that separates them (`instanceof`) is the one that does not
survive a realm boundary.

### What was investigated

This is a study, not a design. It is worth doing before
[browser-testing](browser-testing.md) puts proofs in iframes or workers, because
that is the point at which cross-realm promises stop being hypothetical.

- **State the layering.** One document saying which layer adopts a `then` and
  which layer refuses to, and why both are right. Until that exists, every fix
  to one looks like a bug in the other.
- [x] **Find a brand check that survives a realm and cannot be forged.**
  Answered, and the answer is **no standalone constructor-based check was
  accepted**. `Promise.resolve(p) === p` against the value's own constructor
  looked right and misclassifies an ordinary identity-`resolve` tree, hanging
  the run; and no brand check reaches the case where the value *is* a promise
  and the subscription is the defect. See Findings. The question stopped
  mattering once the scope was written down: the browser runs `.f.mjs` only, so
  it never meets a promise it did not create.
- **Decide whether the runner should see namespace objects at all.** If
  discovery handed the runner a plain record of proofs rather than the module
  namespace, the `then` export hazard would not reach it — and the `then`-export
  ban could become a check rather than a convention.
- [x] **Establish what the 150 lines actually buy.** Done — see Findings. Three
  rows of seven, and one of those three is unreachable by a brand check.

### Findings

The study below was run against `438dd85`. Everything in it is measured, and the
scripts are trivial to re-run; nothing here is inferred from reading the code.

#### What the two runners actually do today

Seven values, put through both runners. `want` is what the runner's own stated
rules say should happen.

| value | want | `fjs t` today | browser today |
| --- | --- | --- | --- |
| same-realm promise | await | await | await |
| **cross-realm promise, rejected** | fail | **reported as a pass** | fails |
| **cross-realm promise resolving to a tree** | walk it | **subtree never discovered** | walked |
| plain `{ then }` proof tree | tree | tree | tree |
| `Symbol.toStringTag: 'Promise'` spoof | tree | tree | tree |
| frozen spoof | tree | tree | tree |
| hostile species, `constructor` pinned | fail | fails (`species`) | fails (`species`) |
| hostile species, `constructor` configurable | — | fails (`species`) | **shadows, recovers, runs the subtree** |

Two things this corrects about the story we had been telling:

- **The exposure is worse than "a rejected promise reads as a pass."** A
  cross-realm promise that *resolves* is walked as an ordinary object, and a
  promise has no enumerable own keys — so every test inside it silently
  disappears. In the fixture, `fjs t` reported 6 tests where 7 exist. A false
  pass is visible in a total; a test that was never counted is not.
- **The spoof defences everyone worries about are not a difference at all** —
  `instanceof Promise` already refuses a `Symbol.toStringTag` spoof, in both
  runners. (An earlier draft of this section went on to conclude that the
  browser's machinery therefore bought little. That conclusion was wrong; see
  the two sections below, which is where this study actually landed.)

#### A brand check is not enough, and `await` is the wrong subscription

The candidate this file named — `v instanceof Promise || v.constructor?.resolve?.(v) === v`
— classifies six of seven values correctly, and recommending it was still
wrong. Two hazards, both raised in review of the first draft of these findings
and both **reproduced**, and both ending in a **hang** rather than a wrong
result:

- **A proof tree can be a false positive without anyone forging anything.** A
  tree whose constructor has an identity-style `resolve` — `class A { static
  resolve(x) { return x } }` — satisfies the check. It is then awaited, its
  enumerable `then` proof is assimilated as a resolver, and a zero-argument
  `then` test that ignores its arguments never settles. Measured: `HUNG`. The
  first draft dismissed this as "deliberate forgery"; it is neither deliberate
  nor forgery.
- **Classifying correctly is not sufficient.** A genuine cross-realm promise
  with an overridden own `then` passes any brand check — it really is a promise
  — and `await` then calls that override, because `await` on a promise from
  another realm goes through `then` rather than adopting it directly. A no-op
  override never settles. Measured: `HUNG`.

The second is the important one: it is not about *identifying* a promise at all.
No brand check can fix it, because the defect is in the subscription that
follows.

**The intrinsic `then` is both, and gets everything right.** What the browser
does — `Reflect.apply(Promise.prototype.then, v, [onOk, onErr])` — is a native
brand check that throws for a non-promise, *and* a subscription that ignores the
value's own `then`:

| value | `instanceof` | `instanceof \|\| ctor.resolve` | intrinsic `then` |
| --- | --- | --- | --- |
| same-realm promise | ✅ | ✅ | ✅ |
| cross-realm promise | ❌ | ✅ | ✅ |
| **cross-realm, own `then` override** | ❌ | **HANGS** | ✅ |
| plain `{ then }` proof tree | ✅ | ✅ | ✅ |
| tagged spoof | ✅ | ✅ | ✅ |
| frozen tagged spoof | ✅ | ✅ | ✅ |
| **identity-`resolve` constructor tree** | ✅ | **HANGS** | ✅ |

One detail is not incidental: the `Reflect.apply` has to sit **outside** a `new
Promise` executor. A throw inside an executor rejects the promise instead of
propagating, so the brand check becomes uncatchable — which is exactly why the
prototype's `subscribe` captured its `settle` first and applied it afterwards.
Written the obvious way instead, the check throws out of the runner. That
prototype is gone with the machinery, so this is a note for whoever writes the
next one rather than a description of code in the tree.

#### The species handling is load-bearing too

Prototyped in `effects/node`'s `sandbox`, treating a throw from the intrinsic
`then` as "not a promise": the cross-realm rows are fixed as expected, but the
hostile-species promise turns from `error: species` into a silent **`ok` with
its subtree lost** — because "this is not a promise" and "this is a promise I
cannot subscribe to" become the same answer. Telling those apart is what
`speciesFails`, the `Object.prototype.toString` re-check and the `constructor`
shadow in `runPromise` are for. They are not decoration.

### Who is this for? — the question the study should have asked first

**FunctionalScript as specified has no promises, and nothing enforces that.** A
conforming `.f.mjs` proof is pure: no `async`, no `await`, nothing that
constructs a `Promise`. But selection is by filename —
`website/browser-prepare.mjs` is a bare `name.endsWith('.f.mjs')` with no
content check — so a module that does not conform is loaded anyway. Verified: a
`.f.mjs` returning `Promise.resolve(...)` is selected (138 of 138) and awaited
correctly. Treat what follows as a statement about the *convention*, which is
why proofs are scarce, not as a guarantee the toolchain provides. So every
promise this runner has ever awaited comes from a hand-written *impure* `.mjs`
proof. Counted:

| | pure `.f.mjs` | impure `.mjs` |
| --- | --- | --- |
| proof modules | **125** | 5 |
| leaves returning a promise (`async () =>`) | **0** | 39 |

All 39 live in `emergent_testing/browser/proof.mjs` (32),
`effects/node/memory/proof.mjs` (5) and
`emergent_testing/browser/species.proof.mjs` (2) — every one an `async` function
written in this repository, in this repository's own realm.

That settles the realm question, and not by argument. A cross-realm promise can
only reach the runner if one of our own impure proofs deliberately builds one
with `node:vm`, an iframe or a worker. The only proofs that do are the ones
testing the cross-realm machinery. **The defence exists to defend against its
own fixtures**, and deleting both leaves nothing uncovered.

**In the browser it is stronger than that: by convention a promise does not
occur.** The browser suite runs authored FunctionalScript and nothing else —
`website/browser-prepare.mjs` line 16 is `name => name.endsWith('.f.mjs')`, and
the generated manifest carries 137 modules, none of them anything else. Impure
`.mjs` proofs are excluded by construction, and rightly so: a browser has no
business running Node tests, and a promise is only the first thing that would go
wrong. So every leaf the browser runner executes is pure FunctionalScript, and
pure FunctionalScript has no promises.

Which means the machinery is circular twice over. It lives in the runner that
*only* executes `.f.mjs`; it is exercised by `species.proof.mjs` and the
cross-realm proofs, which are `.mjs` and therefore **never run in a browser at
all** — they run under `fjs t`, in Node, against the browser runner called as a
library. Machinery in the browser path, tested by fixtures that never reach the
browser, guarding values the browser cannot produce.

The one promise-adjacent value *pure* FunctionalScript can produce is an object
with a key named `then` — a proof called `then`. `p instanceof Promise` refuses
it correctly, which is what `thenIsATestName` asserts and what makes the
structural rule hold.

### Outcome

**The investigation is finished and its decision is implemented; what is left is
deferred, which is what `on-hold` above means.** Nothing here is waiting on a
person: it is waiting on proofs running in iframes or workers, which nothing
does today. The file stays because the measurements below are the input to that
decision when it arrives, and re-deriving them cost several review rounds.

**Done.** The browser's `sandbox` decides with `p instanceof Promise` and then
**`await`s** — exactly as `fjs t` does, and the `await` is the load-bearing half.
`value.then(a, b)` is a different operation: it calls the value's own `then` and
builds its answer through `constructor[Symbol.species]`, either of which a
promise can replace, so a proof's subtree can be lost or the run handed a
non-promise. `await` on a same-realm promise adopts internal state and consults
neither, which is why three lines recover everything the machinery gave for the
values this runner can actually meet.

**The proofs that pinned the `then` and species cases are gone**, deleted in
functionalscript#1796 rather than kept: the rule they were chasing is that a
value which is not a well-known `Promise` is not run as one, full stop, and that
rule is stated on `Sandbox` in `../../effects/common/types.ts` where a reader
meets it. Four proofs enumerating ways to violate a stated rule bought no
guarantee the rule did not already give, and invited the next variant.
`hostileBrandCheckIsReported` went with them as redundant with
`returnedTreeThrows`, which pins the same guarantee — user code throwing while
the runner reads a value fails that test rather than rejecting the run — without
a proxy.

`subscribe`, `speciesFails`, `runPromise` and `species.proof.mjs` are deleted.
What survives in `../browser/proof.mjs` states the rule positively rather than
chasing it: `crossRealmPromiseSilentlyPasses` pins the two runners *agreeing*
rather than the browser defending alone, and `spoofedPromiseTag` and
`frozenPromiseTag` pin that a spoof is walked as an ordinary tree. The gap is
real, shared, and recorded here.

Strictly, the browser needs no promise handling whatever — it runs only
`.f.mjs`. `instanceof` is kept anyway: one expression, and it keeps the two
runners' `sandbox` identical rather than "identical except the browser omits a
branch", which is the kind of small asymmetry drift starts from.

That is not a compromise on correctness. It is correct for every value the
language can produce, and for every value any proof in this repository actually
produces. What it gives up — cross-realm promises, `Symbol.species` recovery,
spoof defences — are answers to questions that only a fixture has ever asked.

The earlier drafts of this section were both wrong, in opposite directions and
for the same underlying reason: neither asked who the machinery was *for*. The
first proposed a three-line brand check and would have introduced two ways to
hang the suite. The second, correcting that, concluded the browser's mechanism
was right and `fjs t` should adopt it — trading 150 lines and a subtle
subscription protocol for a threat model that does not exist here.

**If proofs ever run in iframes or workers** — which
[browser testing](browser-testing.md) contemplates and nothing does today — a
cross-realm promise becomes reachable for the first time. (Running impure `.mjs`
proofs in a browser is the other way it could happen, and
[browser testing](browser-testing.md) records why that is not a goal.) That is the moment to
revisit this, with a real case in hand rather than a constructed one, and the
material is preserved above: the intrinsic `Promise.prototype.then` is both the
brand check and the subscription, its `Reflect.apply` must sit outside a `new
Promise` executor, and a throw from it must not be conflated with "not a
promise". Reach for it then, not now.

### What the cross-realm gap actually costs, and the options

Both runners walk a cross-realm promise as an ordinary value. Measured, the
consequences are not one symptom but two, and the second is worse than the
phrase "reported as a pass" suggests:

| the proof returns | what happens |
| --- | --- |
| a cross-realm promise **resolving** to a sub-tree | reported `passed`; the tests inside it are never discovered, because a promise has no enumerable keys — one test where there are two |
| a cross-realm promise that **rejects** | never awaited, so the rejection is unhandled — under Node's default `--unhandled-rejections=throw` the **process dies before the report is read** |

`crossRealmPromiseSilentlyPasses` pins the first. The second is deliberately not
a proof: a test that kills the runner is not a test, which is itself worth
knowing about this failure mode.

**This is a debt, not a menu.** [REVIEW.md](../../../REVIEW.md) says an
unsupported input is refused, never answered with a plausible wrong value, and a
cross-realm promise reported as `passed` is exactly that. So refusal is what
this owes; the entries below are what it would cost to pay it, and the reason it
is deferred rather than done is that the only available detector is measurably
worse than the defect. It is deferred as a pre-existing defect — both runners
have always behaved this way — and it is not deferrable indefinitely.

Three ways to pay it, with what each costs:

- **Leave it.** Both runners agree, and the value is unreachable from authored
  FunctionalScript — only an impure proof using `node:vm`, an iframe or a worker
  can build one. This is the current state, and it is a deferral rather than an
  answer. Its price is the table above, and a proof that names it.
- **Subscribe with the intrinsic `then`** (the deleted machinery). Correct on
  every case. Its price is ~150 lines in the path that executes every proof
  body, plus `speciesFails` and the shadow to tell "not a promise" from "promise
  I cannot subscribe to". Belongs in the shared `sandbox` if taken, never in one
  runner.
- **Refuse the value loudly** — report an unsupported cross-realm promise as a
  failure rather than walking it. Cheaper than subscribing and *not free*: it
  needs a detector, and the only candidate is `Object.prototype.toString`, which
  this study measured at 5 of 7. Its two misses are exactly `spoofedPromiseTag`
  and `frozenPromiseTag` — so a proof tree that carries a `then` key and sets
  `Symbol.toStringTag: 'Promise'` would be failed instead of walked. That trades
  a silent pass on an unreachable value for a false failure on a reachable one.
  A refusal that fires on valid input is not refusing loudly; it is a new wrong
  answer with a louder voice. **This is the shape of the fix, and it needs a
  detector that does not exist yet** — finding one is the actual open work here.

Whichever is chosen, it is a change to the rule both runners share, so it lands
in the shared `sandbox` — step 4 and after in
[share the browser and console proof runners](share-browser-console-runner.md) —
and never in one host alone.

### `fjs t` still hangs on a promise whose `constructor` was replaced

`await` adopts a promise's internal state only when its `constructor` is the
intrinsic `Promise`. Otherwise resolution assimilates the value by calling its
`then`, so a `Promise` subclass — or any promise whose `constructor` has been
replaced — that also overrides `then` never settles:

| value | `fjs t` | browser |
| --- | --- | --- |
| `class Sub extends Promise { then() {} }`, resolved | **HUNG** | settles |

The browser subscribes with the intrinsic `Promise.prototype.then` rather than
`await`, which ignores the override — about fifteen lines, and not the machinery
this issue deleted: `speciesFails`, the `constructor` shadow and its retry are
still gone, because those *recover* a hostile species rather than subscribe.
`promiseWithReplacedConstructorStillSettles` pins it.

**`fjs t` owes the same fix**, and it is one line in `effects/node/module.mjs`'s
`sandbox` once the settlement path is shared — step 4 and after in
[share the browser and console proof runners](share-browser-console-runner.md).
Until then the two differ, which is a difference with a written reason: the
browser had this behaviour before the deletion, losing it was a regression, and
a regression is not deferrable. `fjs t`'s hang is older than this work and is
deferred behind this note.

It is also worth knowing what neither runner can fix here: **any** proof
returning a promise that never settles hangs any runner —
`() => new Promise(() => {})` needs no subclass and no override. Bounding a
proof's running time is the general answer and is not this issue.

### If a runner ever needs to accept generic input

Everything below is deleted from the browser runner and unreachable from
authored FunctionalScript, which has no `Promise`. The subset itself is the
spec's to state, not this file's — and paraphrasing it from memory is what
produced two wrong descriptions here already.
It is recorded so that the day a runner must accept values it did not author —
impure `.mjs` proofs, an iframe, a worker, a third party calling
`runBrowserProofs` — the work is a lookup rather than a rediscovery. Each row is
measured, against the implementation that had the machinery and the one that
does not.

| input | with the machinery | with `instanceof` + `await` |
| --- | --- | --- |
| cross-realm promise resolving to a sub-tree | subtree runs | subtree never discovered, reported `passed` |
| cross-realm promise that rejects | reported as a failure | **the process dies** on an unhandled rejection, before any report |
| object with `Promise.prototype` on its chain and no internal slots | walked as a proof tree | reported as a failure; its sub-tree lost |
| promise whose `constructor[Symbol.species]` throws, `constructor` configurable | recovered — subtree runs | reported as a failure |
| the same, `constructor` non-configurable | reported as a failure | reported as a failure |
| non-extensible impostor | walked as a proof tree | reported as a failure |
| promise fulfilled with a proof tree that gains a `then` test afterwards | walked | walked |
| the same, with the promise's `constructor` replaced | walked | **hangs** — `await` wraps it, and the wrapper's resolver assimilates the tree's `then` |
| promise whose `constructor` is replaced and whose own `then` is overridden | walked | **hangs** |

Two of those rows turn on the same mechanism and are worth stating once: `await`
adopts a promise's internal state only when its `constructor` is the intrinsic
`Promise`. Replace the constructor and resolution goes the long way round —
through a `then` the value may have overridden, and through a wrapper whose
resolver will assimilate a fulfilled proof tree that carries a `then` of its
own. Every hang in this table traces back to that one sentence.

And what each deleted piece was for, which was written down nowhere and is why
deleting it looked free:

- **the intrinsic `Promise.prototype.then` as the brand check** — the only test
  that survives a realm boundary, because `instanceof` asks about *this* realm's
  prototype;
- **shadowing `constructor` with the intrinsic `Promise` and retrying** — one
  step doing two jobs: it separates an impostor from a genuine promise whose
  species failed, and it *recovers* the second;
- **`speciesFails` and the `Object.prototype.toString` re-check** — the same
  separation for a value that cannot be shadowed.

Three things to consider first, if the day comes:

- **Ask what changed, before restoring any of it.** The reason this was deleted
  is that the browser suite runs authored `.f.mjs` only. If that is still true,
  the answer is still no machinery. If it is not, the scope rule in
  [browser testing](browser-testing.md) is what actually moved, and this
  follows from it rather than the other way round.
- **Put it in the shared `sandbox`, not one host.** `fjs t` has every gap in the
  table above and has had them for the project's whole life, with no incident;
  fixing one runner alone re-creates the split this work exists to remove.
- **Bound a proof's running time.** Two rows above are hangs, and the general
  answer to a hang is a deadline, not a promise-shaped defence — `() => new
  Promise(() => {})` needs none of this machinery to stop a run forever.

### Constraints

- An object carrying a `then` proof property must stay an ordinary proof tree.
- Whatever is added must apply to every runner. A defence in one host only is
  the state this is trying to leave.

### Related

- [Hostile proof values](hostile-proof-values.md) — the cross-realm promise
  exposure, and the traversal guard it shares a cause with.
- [Browser testing](browser-testing.md) — iframes and workers.
- [`spec/todo/3240-export.md`](../../../spec/todo/3240-export.md) — the `then`
  export ban.

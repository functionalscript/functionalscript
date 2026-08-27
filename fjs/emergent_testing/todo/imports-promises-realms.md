## Investigate imports, promises and realms

**Priority:** P3
**Status:** open — investigated; a decision is now the only thing missing

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
runner defends against this with `Symbol.species` shadowing and an intrinsic
`then` — about 150 lines (`../browser.mjs`, `../browser/species.proof.mjs`) that
read as a magic mess and are, today, the only place the exposure is covered. So
the two runners answer this question differently, and
[sharing them](share-browser-console-runner.md) forces a single answer: keep the
machinery, replace it with something statable, or accept `fjs t`'s exposure
knowingly. Deciding that by default, inside a port, is how the coverage gets
lost without anyone choosing to lose it.

The three are usually discussed one at a time, which is why the interaction
keeps being rediscovered: the thing that makes a namespace dangerous (`then` is
adopted) is the thing the runner deliberately refuses to do (`then` is a name),
and the check that separates them (`instanceof`) is the one that does not
survive a realm boundary.

### What to investigate

This is a study, not a design. It is worth doing before
[browser-testing](browser-testing.md) puts proofs in iframes or workers, because
that is the point at which cross-realm promises stop being hypothetical.

- **State the layering.** One document saying which layer adopts a `then` and
  which layer refuses to, and why both are right. Until that exists, every fix
  to one looks like a bug in the other.
- [x] **Find a brand check that survives a realm and cannot be forged.** Done —
  see Findings. `Promise.resolve(p) === p` against the value's own constructor
  works, combined with `instanceof`; it is forgeable only deliberately.
  Whatever is chosen must be one function every interpreter calls.
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
- **The 150 lines buy less than assumed.** Of the seven cases, the browser and
  `fjs t` differ on exactly three: the two cross-realm rows, and the
  configurable hostile-species row. The spoof defences everyone worries about
  are not a difference at all — `instanceof Promise` already refuses a
  `Symbol.toStringTag` spoof, in both runners.

#### A brand check that survives a realm

The candidate this file named turns out to work, in combination with the check
that is already there:

```js
const isPromise = v => {
    if (v instanceof Promise) { return true }
    try {
        const c = v?.constructor
        return typeof c?.resolve === 'function' && c.resolve(v) === v
    } catch { return false }
}
```

`Promise.resolve` returns its argument unchanged when the argument is a promise
whose `constructor` is the receiver — a native identity that holds in the
promise's *own* realm, which is the thing `instanceof` cannot reach across.

| value | `instanceof` | `toStringTag` | `instanceof \|\| ctor.resolve` |
| --- | --- | --- | --- |
| same-realm promise | ✅ | ✅ | ✅ |
| cross-realm promise | ❌ | ✅ | ✅ |
| plain `{ then }` tree | ✅ | ✅ | ✅ |
| tagged spoof | ✅ | ❌ | ✅ |
| frozen tagged spoof | ✅ | ❌ | ✅ |
| hostile-species promise | ✅ | ✅ | ✅ |
| deliberately forged `constructor.resolve` | ✅ | ✅ | ❌ |

Six of seven, against `instanceof`'s six and `toStringTag`'s five — and the one
it misses is the one nobody reaches by accident. A proof named `then` has
`Object` for a constructor and `Object.resolve` does not exist, so the rule this
file exists to protect — an object carrying a `then` proof stays a proof tree —
holds. Forging `constructor.resolve` to return its own receiver is not something
a test author does by mistake, and proofs are this repository's own code rather
than adversarial input.

**Measured in place.** Prototyped in `effects/node/module.mjs`'s `sandbox` and
`awaitPromise` and reverted: the rejected cross-realm promise becomes a failure,
the resolved one's subtree is discovered and its failing child reported (6 tests
→ 7), the spoof and hostile-species rows are unchanged, and the full suite stays
3477/3477 at 100% coverage. So it is three lines, it fixes a real `fjs t` bug,
and it costs nothing that is currently working.

#### What it does not buy

The configurable hostile-species case — a genuine promise whose `constructor`
has been replaced by one whose `Symbol.species` getter throws, where the browser
today shadows `constructor` with the intrinsic `Promise` for the length of one
subscription and thereby still runs the subtree. A brand check cannot recover
that, because the failure happens *after* the check, inside `then`. Keeping it
means keeping `subscribe`, `speciesFails` and the shadow — roughly the whole 150
lines — for one row of the table.

### Recommendation

Adopt the combined check in the shared `sandbox`, and drop the species
machinery, recording the configurable hostile-species case as knowingly given
up. That is one rule, stated in three lines, that both runners can hold; it
closes an exposure `fjs t` has today; and it leaves the browser worse off in
exactly one exotic case rather than in the three the naive port would have.

The alternative — keep the machinery and make `fjs t` adopt it — is available
and is not obviously wrong, but it is 150 lines of `constructor` shadowing in
the path that executes every proof body in both hosts, to defend a case that has
never been observed outside a proof written to construct it.

**This is the decision that unblocks step 3 of
[share the browser and console proof runners](share-browser-console-runner.md).**
Either answer unblocks it; what must not happen is a port choosing by accident.

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

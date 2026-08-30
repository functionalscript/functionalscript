## package-check-unsupported-package-shapes. `package-check` assumes our package's shape

**Priority:** P5
**Status:** open

### Problem

[`../package/module.f.mjs`](../package/module.f.mjs) generates a job that
installs the packed tarball and type-checks it. It works for a package shaped
like this repository's, and three review findings on
[#1767](https://github.com/functionalscript/functionalscript/pull/1767) named
shapes it does not handle — one of them fixed as far as a glob can go, the rest
declined. This file is where the answers live now.

All three are the same question — how far does `fjs ci` go for a project that is
not us? [`ci-generator-audience.md`](./ci-generator-audience.md) asks it of the
generator as a whole, and settling that one settles these.

**1. Declarations reachable only through `typesVersions`.** The job checks every
declaration the tarball ships, which is a superset of what any entry point
reaches, so a `typesVersions` map changes nothing about *coverage*. What it
would change is whether the map itself is exercised: a package whose
`typesVersions` points at a path it does not ship gets a green check today.

**2. A package that ships no declarations at all.** The job is generated for
every project now, and this one fails it with `TS18003`: `include` matches
nothing, and TypeScript says so rather than passing on an empty set. Loud, and
arguably right — a package whose consumers get no types is a package this check
has nothing to say about — but it is a red job rather than an absent one, and
the project did not ask for either.

This case replaced a different one. The job used to be generated only when the
project's `package.json` pinned an exact `devDependencies.typescript`, so a
project with no compiler of its own simply had no packed-package check; the
open question then was whether `fjs ci` should refuse loudly instead of quietly
emitting one job fewer. [`typescript-ci-tool`](https://github.com/functionalscript/functionalscript/pull/1795)
moved the compiler to `../config/module.f.mjs`, which settled that by removing
the choice: there is no longer anything about the project for the job to depend
on.

**3. A declaration under two consecutive dot-prefixed segments.**
`.a/.b/x.d.ts` is packed by npm and skipped by `tsc`. npm's `**` walks into a
dot-prefixed name and TypeScript's does not, so `include` names dot segments
explicitly — `**/.*` and `**/.*/**/*`, which cover a dot-named file and
anything under one dot-named directory at any depth. Two in a row still
escape: the inner `**` has to cross the second. Closing it properly means
enumerating the names, which needs a tool walking the tree and so needs
approval under [root `AGENTS.md` §6](../../../AGENTS.md#6-external-tools).
Nothing in this package ships a dot-prefixed path today; unlike the others
this one *is* reachable, because `files` would publish such a file.

**4. A package that ships `.ts` sources and no declarations.** `include` is
`**/*`, so TypeScript sources are a nonempty root set and the `TS18003`
empty-check never fires: `npx tsc` succeeds having checked no declaration.
Unreachable here — root `package.json` `files` is an allowlist
(`**/*.js`, `**/*.d.ts`, `**/*.mjs`, `**/*.d.mts`) with no pattern matching a
source file — and the fix has a real cost, so it is recorded rather than built.
See the comment on `tsconfig` in [`../package/module.f.mjs`](../package/module.f.mjs).

### Proposal

No design agreed, and deliberately so: the first two are only worth building
once a project outside this repository runs `fjs ci`, and none is known to. The
third is worth building the day this package ships a `.ts` source, which its
`files` field currently forbids.

What each would cost, so the next person does not re-derive it:

- **(1)** Read `typesVersions` from the installed `package.json` and add a
  generated import per mapped entry. Needs the packed manifest parsed in a
  generated step, which is new machinery for a case no consumer has.
- **(2)** Nothing, if a red `package-check` is the right answer for a package
  that publishes no types. If it is not, the cheapest alternative is a
  declaration in `Setup` — the project says it ships none, and the job is not
  generated — which puts the decision with the project rather than with a
  heuristic reading its `files` field.
- **(3)** A pattern per arrangement of dots does not converge — each new
  pattern covers one more shape and there are unboundedly many. The complete
  fix reads the installed tree's real names, so it is the §6 conversation.
- **(4)** Either enumerate declaration extensions in `include` — the
  hand-written list removed in
  [5f90cda](https://github.com/functionalscript/functionalscript/commit/5f90cda),
  which review had already caught omitting `.d.cts` — or count declarations in a
  separate step, which needs a tool walking the tree and so needs approval under
  [root `AGENTS.md` §6](../../../AGENTS.md#6-external-tools). Both undo a change
  that fixed three defects.

### Tasks

- [ ] Establish whether any project outside this repository runs `fjs ci`. If
      none does, close (1) and (2) as speculative generality.
- [ ] Decide whether `TS18003` is the right answer for a package that ships no
      declarations, or whether such a project should be able to say so
- [ ] Build (4) the day root `package.json` `files` admits a `.ts` source, and
      not before.
- [ ] Close (3) if the §6 conversation permits a tool that reads the installed
      tree; until then a dot-in-dot path is an unchecked declaration.

### Related

- [`../package/module.f.mjs`](../package/module.f.mjs) — the job.
- [`../README.md`](../README.md) — the `package.json` contract the job reads.
- [`ci-generator-audience.md`](./ci-generator-audience.md) — the same "what is
  `fjs ci` for" question, asked of the generator as a whole.

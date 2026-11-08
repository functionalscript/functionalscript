## Steps carry their environment and check; nothing reads it back from text

**Priority:** P3
**Status:** open

### Problem

The assembler knows, when it builds a step, which environment the command
runs in and which check it belongs to. That knowledge is erased into a
`run` string, and two later layers reconstruct it from the text.

[`environment`](../environment/module.f.mjs) emits a placeholder prefix:

```js
export const commandPrefix = 'env '
export const environmentCommand = command => `${commandPrefix}${command}`
```

`migratedStep` in [`mise`](../mise/module.f.mjs) recovers the intent by
matching it:

```js
const spiderMonkey = run.includes('js --version') || run.includes('npm run sm ')
const generated = run.startsWith(commandPrefix) || run.startsWith(`test "$(${commandPrefix}`)
const translated = generated ? run.replaceAll(commandPrefix, prefix)
    .replaceAll('wasmtime --version)', "wasmtime --version | cut -d' ' -f1,2)")
    : run === `test "$(node --version)" = "v${node}"` ? `test "$(mise exec -- node --version)" = "v${node}"` : run
…
if (['cargo ', 'npm ', 'node ', 'fjs ', 'tsc'].some(command => run.startsWith(command))) {
```

and `checkId` in [`smart`](../smart/module.f.mjs) parses the result a
third time, through `shellPrefixes` and a chain of `startsWith` and `===`
against whole commands, to decide a step's cache rung. `intelMacSteps` in
[`module.f.mjs`](../module.f.mjs) spells the Node version test by hand in
exactly the form `migratedStep` must recognise, and `mise`'s `action` and
`smart`'s `isAction` are the same predicate under two names.

This is the hazard [AGENTS.md §6](../../../AGENTS.md#6-external-tools)
describes, inside our own generator: a reworded command, or a new one,
has to be taught to all three layers, and one it is not taught to lands
silently in the wrong environment or the wrong cache rung.

### Proposal

Carry the intent on `MetaStep` in [`common/types.ts`](../common/types.ts):
an `environment` of `mise`, `spidermonkey` or `none`, and the check the
step belongs to, written once by the builders that know them, with
`environmentSteps` and `shellSpiderMonkeyCommands` tagging what they make.
One renderer, beside `toSteps` in [`common`](../common/module.f.mjs),
turns a tagged step into its `run`, `shell` and prefix; `smart` reads the
tag instead of the text. `migratedStep`, `replacedSetup`, `shellPrefixes`,
`command`, `checkId` and one of `action` and `isAction` go, and
`intelMacSteps`' version test is the same `versionStep` as every other
platform's.

### Tasks

- [ ] The tags on `MetaStep` and the builders that set them.
- [ ] The renderer in `common`; `mise` over it, `migratedStep` gone.
- [ ] `smart` reads the tags; `checkId` gone.
- [ ] `npm run gen`; the committed workflows must not change.

### Related

- [six-ci-jobs](./six-ci-jobs.md) — restructures the jobs over the same
  builders.
- [investigate-mise-pixi](./investigate-mise-pixi.md) — the migration
  `migratedStep` was written for.

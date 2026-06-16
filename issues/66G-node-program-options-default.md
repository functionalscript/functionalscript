# 66G-node-program-options-default. Add a default `NodeProgramOptions` for use in proofs

**Priority:** P3
**Status:** open

## Problem

Proof files that call programs (e.g. `fs/fjs/proof.f.ts`, `fs/cli/proof.f.ts`,
`fs/cas/proof.f.ts`) each define a local `makeOptions` helper that constructs a
full `NodeProgramOptions` literal:

```ts
const makeOptions = (args: readonly string[]): NodeProgramOptions => ({
    args,
    env: {},
    home: '.',
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
    testContext: { test: async () => {} },
    bunTestContext: { test: async () => {} },
    playwrightTestContext: { test: async () => {} },
    engine: 'node',
})
```

Every time a new property is added to `NodeProgramOptions`, every such helper
must be updated by hand. This is fragile and creates unnecessary churn across
unrelated proof files.

## Proposal

Export a `defaultNodeProgramOptions` constant from
`fs/effects/node/module.f.ts` that supplies safe, inert defaults for every
field:

```ts
export const defaultNodeProgramOptions: NodeProgramOptions = {
    args: [],
    env: {},
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
    testContext: { test: async () => {} },
    bunTestContext: { test: async () => {} },
    playwrightTestContext: { test: async () => {} },
    engine: 'node',
}
```

Proof files then spread-override only what matters for the test:

```ts
const makeOptions = (args: readonly string[]): NodeProgramOptions =>
    ({ ...defaultNodeProgramOptions, args })
```

Future additions to `NodeProgramOptions` only require a default in one place.

## Tasks

- [ ] Add `defaultNodeProgramOptions` to `fs/effects/node/module.f.ts`.
- [ ] Replace local `makeOptions` bodies in proof files with spread of
      `defaultNodeProgramOptions`.
- [ ] Verify that all existing proof assertions still pass.

## Related

- `fs/effects/node/module.f.ts` — `NodeProgramOptions` type definition (line 430).
- `fs/fjs/proof.f.ts`, `fs/cli/proof.f.ts`, `fs/cas/proof.f.ts`,
  `fs/text/sgr/proof.f.ts`, `fs/emergent_testing/proof.f.ts` — files with
  duplicated `makeOptions` helpers.

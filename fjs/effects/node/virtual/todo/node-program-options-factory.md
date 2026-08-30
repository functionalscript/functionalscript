## node-program-options-factory. Export the `NodeProgramOptions`-from-args factory the JSDoc already spells out

**Priority:** P5
**Status:** open

### Problem

Three proof files re-type the same one-liner:

```js
// fjs/cli/proof.f.mjs:11-13, fjs/cas/cli/proof.f.mjs:13-15, fjs/proof.f.mjs:11-12
/** @type {(args: readonly string[]) => NodeProgramOptions} */
const makeOptions = args => ({ ...defaultNodeProgramOptions, args })
```

The shape was even named in prose — `defaultNodeProgramOptions`' JSDoc
(`fjs/effects/node/virtual/module.f.mjs:434`) shows
`const opts: NodeProgramOptions = { ...defaultNodeProgramOptions, args }` as
the intended usage — but never exported, so each call site re-derives it.

### Proposal

Export it next to the default (`fjs/effects/node/virtual/module.f.mjs:442`):

```js
/** @type {(args: readonly string[]) => NodeProgramOptions} */
export const nodeProgramOptions = args => ({ ...defaultNodeProgramOptions, args })
```

and delete the three copies.

### Tasks

- [ ] Export `nodeProgramOptions` (with proof coverage); update the JSDoc
      example to reference it.
- [ ] Replace `makeOptions` in the three proof files.
- [ ] `tsc`, `fjs t`.

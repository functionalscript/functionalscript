## One lexical `resolveFileModule`, not one per host

**Priority:** P4
**Status:** open

### Problem

A host `.mjs` is a thin boundary and the logic is FunctionalScript
([AGENTS.md §3](../../../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
How a module's identity is built from a specifier and its parent is logic,
and it is written in two hosts. The SpiderMonkey host's `resolveFileModule`
handler in [`spidermonkey/module.mjs`](../../spidermonkey/module.mjs),
commented "Lexical, as the virtual host resolves":

```js
const path = parent === null ? absolute(name) : resolveImportPath(parent)(name)
if (path === null) { throw new Error('invalid module specifier') }
return { id: normalize(path), path }
```

and the virtual runner's `resolveFileModule` in
[`virtual/module.f.mjs`](../virtual/module.f.mjs):

```js
const path = parent === null ? name : resolveImportPath(parent)(name)
return [state, path === null ? fail('invalid module specifier') : ok({ id: normalize(path), path })]
```

The Node host's handler in [`module.mjs`](../module.mjs) spells the same
refusal message a third time. The parts that differ are host facts — the
SpiderMonkey shell has no `realpath`, so it anchors a root specifier with
`absolute` — and the parts that agree are the rule.

### Proposal

One pure function beside the `FileModule` type, in `module.f.mjs` or in
[`fjs/path/import`](../../../path/import/module.f.mjs):

```js
/** @type {(name: string, parent: string | null) => Result<FileModule, string>} */
export const lexicalFileModule = (name, parent) => { … }
```

with the refusal message as an exported constant. The two runners become
one-line adapters over it, SpiderMonkey passing `absolute(name)` for a root.
[node-modules-resolution](../../../../todo/node-modules-resolution.md) then
has one place, not two, to add its stage-1 refusal of bare specifiers on
these hosts.

### Tasks

- [ ] `lexicalFileModule` with its proof.
- [ ] The SpiderMonkey and virtual `resolveFileModule` handlers over it; the
      Node handler imports the message constant.

### Related

- [node-modules-resolution](../../../../todo/node-modules-resolution.md) —
  wants the resolution convention "written once", and lists the Node,
  virtual and native hosts but not SpiderMonkey.
- [lexical-path-resolution](../virtual/todo/lexical-path-resolution.md) —
  `..` in file paths, not module identity.

## The hosts copy what `effects` already shares: `all` and the window size

**Priority:** P3
**Status:** open

### Problem

[`common/module.mjs`](../common/module.mjs) is "host implementations of the
operations more than one host implements", kept there so that "the second
host [does not write] a second copy"; [`module.mjs`](../module.mjs)'s `io` is
"shared by the Node host and the SpiderMonkey host". The hosts still carry
copies of what those two own.

**`all`.** `All` is declared in `common/types.ts`, but its handler is not in
`commonOperationMap`, because it needs the runner it is part of. So
[`node/module.mjs`](../node/module.mjs) and
[`spidermonkey/module.mjs`](../spidermonkey/module.mjs) each write it:

```js
all: async (...effects) => ok(await Promise.all(effects.map(runNodeEffect))),
all: async (...effects) => ok(await Promise.all(effects.map(runShellEffect))),
```

**The window.** Both hosts define `const maxFileSizeBytes =
Number(maxLengthBytes)` and window `readWhole` into it, one with a `fill`
loop and one with `Array.from`; the Node host builds the `FileStat` literal
`{ size, isFile, isDirectory }` in `stat` and again in `fstat`.

### Proposal

- `all` answered by the runner itself: `asyncRun` and `asyncPartialRun` in
  [`module.mjs`](../module.mjs) build the loop that dispatches an operation,
  so they are the one place that holds the runner `all` maps over, and they
  add the `all` handler to the map they are given — only where the runner
  declares `All`. A partial runner declares its vocabulary in its
  `commands`, so `asyncPartialRun` adds `all` where they name it and not
  otherwise: the demo runtime's runner, over `Sandbox | Catch | RandomInt`,
  answers no `all`, and a stray `all` node still asserts as the command it
  is not. A whole runner declares it in its type alone, which the loop
  cannot read, so the declaration is a builder: `asyncRunAll(map)` is
  `asyncRun` with `all` tied over its own loop, and the Node host takes
  it; the SpiderMonkey host's `runShellEffect` is
  `asyncPartialRun(nodeCommands)` already — it implements part of `NodeOp`
  and answers `notImplemented` for the rest through the partial runner —
  and stays so, taking `all` because `nodeCommands` name it; the browser's
  two runners, over `Catch |
  Sandbox | _BrowserReport` and `Import | _BrowserReport`, declare no `All`
  — [node-module-layering](./node-module-layering.md) records that its
  loading walk is a sequential fold again and `All` has no second
  implementer — and stay on `asyncRun`. No host writes the handler. The knot
  is what
  rules out the plainer `commonOperationMapFor(runNodeEffect)`: each host's
  runner is a `const` whose initializer is the map, so passing the runner
  into the map reads it in its own temporal dead zone, where the inline
  handlers only close over it. A map built by the runner, or one given a
  thunk of it, is the shape; the first needs nothing from the hosts.
- `maxFileSizeBytes` exported as `_maxFileSizeBytes` — linkage between the
  two hosts, not API — from [`node/module.f.mjs`](../node/module.f.mjs),
  which already builds `fileSizeRefusal` on the same number, and the
  `readWhole` windowing as one function beside it; a `fileStat` helper in the
  Node host for `stat` and `fstat`.

node-module-layering moves the declarations; this is the handlers, which it
does not mention.

### Tasks

- [x] `asyncRunAll`, which the Node host takes, and `all` in
      `asyncPartialRun` where its commands name it, which gives the
      SpiderMonkey host its own, with proof; both hosts drop theirs.
- [x] The browser `import` through `io`; one phrase for the unreadable value,
      pinned on every host's report: `unreadableThrownValue` in
      `module.f.mjs`.
- [x] The window size shared, as `_maxVecBytes` in `node/module.f.mjs`,
      which its own chunked writes read too; `fileStat` in the Node host.
      The windowing stays per host: the Node host fills windows from a
      handle until one comes back short, without the file's size, while
      the SpiderMonkey shell hands back the whole file and the host slices
      it, so the two share the size and not a loop.

### Related

- [node-module-layering](./node-module-layering.md) — the declarations' side
  of the same boundary.
- [allvoid-combinator](./allvoid-combinator.md) — why `All` sits where it
  does.

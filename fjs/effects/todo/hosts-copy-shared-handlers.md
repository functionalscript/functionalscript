## The hosts copy what `effects` already shares: `all`, `io`, the window size

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

**`io`, by hand, with a second phrase.** The browser runner's `import`
handler in
[`fjs/emergent_testing/browser/module.mjs`](../../emergent_testing/browser/module.mjs)
writes `io`'s two-level `try`/`catch` out — importing `_readThrown`,
`toIoError` and `ioError` to do it — and names the unreadable value
`unknownValue`, "Unknown thrown value", where every operation on the other
two hosts says `_unreadableThrownValue`, "thrown value could not be read".
One fact, two spellings in the reports, which is what `unknownValue`'s own
doc says it exists to prevent.

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
  `asyncRun` with `all` tied over its own loop, and the Node and
  SpiderMonkey hosts take it; the browser's two runners, over `Catch |
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
- The browser `import` handler is `io(() => import(specifier(…)))`, and one
  phrase: either `_unreadableThrownValue` loses its underscore and
  `unknownValue` is it, or `io` takes the phrase as an argument. The owner's
  call; the first is simpler.
- `maxFileSizeBytes` exported from [`node/module.f.mjs`](../node/module.f.mjs),
  which already builds `fileSizeRefusal` on the same number, and the
  `readWhole` windowing as one function beside it; a `fileStat` helper in the
  Node host for `stat` and `fstat`.

node-module-layering moves the declarations; this is the handlers, which it
does not mention.

### Tasks

- [ ] `asyncRunAll`, and `all` in `asyncPartialRun` where its commands name
      it, with proof; the Node and SpiderMonkey hosts drop theirs.
- [ ] The browser `import` through `io`; one phrase for the unreadable value,
      pinned on every host's report.
- [ ] `maxFileSizeBytes` and the windowing shared; `fileStat` in the Node host.

### Related

- [node-module-layering](./node-module-layering.md) — the declarations' side
  of the same boundary.
- [allvoid-combinator](./allvoid-combinator.md) — why `All` sits where it
  does.

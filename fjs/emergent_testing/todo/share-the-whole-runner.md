## Share the whole runner, not just its proof semantics

**Priority:** P2
**Status:** open

### Problem

The proof *semantics* are shared: `../module.f.mjs` decides what a leaf is, how
a returned tree is walked, what `throw` means, which values are asynchronous,
how a path is spelled and how results are counted, and `fjs t` and the browser
both go through it. What is **not** shared is the runner around them. Each host
still writes its own program:

| | `fjs t` | browser |
| --- | --- | --- |
| entry | `main` → `testAll` → `runModuleMap` | `browser/module.f.mjs`'s `main` |
| discovery | `loadModuleMap` over `readdir` + `import` | a generated manifest, linked one specifier at a time |
| reporting | `defaultReporter` → `Write` | `recordingReporter` → `report` |
| outcome | an exit code through `exitCodeStep` | a `BrowserTestReport` |

Two of those four differ for a real reason and two do not. A browser has no
`stdout` and no exit code, so `Write` and `Program` genuinely cannot cross —
but "load these modules, run them, answer an outcome" is one program written
twice, and every future host writes it a third time.

The formatting drift this issue was raised over is the symptom worth keeping in
mind: the page rendered `./a.proof.f.mjs .x` where the terminal rendered
`import("./a.proof.f.mjs").proof.x()`. One identifier, two spellings, months
after the semantics were shared — because *rendering* was still per host. That
is fixed (`fmtCall`), but only that instance of it.

### Preliminary design

Lift the host difference into the program's parameters instead of into a
separate program per host. Two shapes are worth comparing before either is
built:

**An artificial effect per host capability.** Where a host lacks an operation,
replace it with one every host can implement at the semantic level: `log` is not
available in a browser, but `testReport` is — a page renders it, a terminal
formats it, an MCP server serializes it. `report`/`reported` already exist and
are exactly this move made once; the question is whether the *whole* set can be
expressed that way, including discovery and the run's outcome.

**Dependency injection of the effect-producing functions.** The runner is
generic in its operation set and takes the host's verbs as a record:

```ts
type Host<O extends Operation> = {
    readonly log: (message: string) => Effect<O, void, IoChannel>
    readonly load: () => Effect<O, ModuleMap, IoChannel>
    readonly import: (source: string) => Effect<O, Module, IoChannel>
}
```

`Reporter<O>` is already this shape for one third of the job, so the question
is whether extending it beats adding operations, or whether the two are the
same thing written differently.

Whichever is chosen, the test is concrete: adding a third host — an MCP server,
a worker, `fjs browser-test` — must not mean writing a fourth `main`.

### Constraints

- The shared semantics must not acquire terminal text or DOM: a `TestResult`
  carries neither today and that is what lets both reporters render it.
- A browser must not gain a `Write` or a `Program` it cannot honour. Lifting the
  abstraction means finding the operation both hosts *can* implement, not giving
  one a stub.

### Tasks

- [ ] Inventory what each host's `main` does that is not host-specific.
- [ ] Choose between artificial effects and injected verbs, and write down why.
- [ ] Express discovery once, so a manifest and a `readdir` walk are two
      implementations of one operation rather than two programs.
- [ ] Express the outcome once, so an exit code and a report are two renderings
      of one value.

### Related

- [Browser testing](browser-testing.md) — the hosts that are still to come.
- [Test-runner behavior](661-test-runner-behavior.md) — the differences between
  runners that are intentional, and must stay intentional.

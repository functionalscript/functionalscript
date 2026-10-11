## Leave `test` to the hosts that have a test framework

**Priority:** P4
**Status:** open

### Problem

`test` of `fjs/effects/node/types.ts` registers a named test with a
`TestContext`, a thin wrapper over an external framework's `test` function: Node
`--test`, Bun or Deno (`registerModule` in `fjs/emergent_testing/module.f.mjs`).
The Node runner answers it by calling `ctx.test(name, { expectFailure }, ...)`
and running the nested effect inside the framework's callback; the framework
owns scheduling, reporting and the process's exit code.

The native host has no such framework, so there is nothing for `ctx` to be:
the value is a JavaScript object with a function in it. Something would have to
be invented, and the native host's own test runner has no use for it, since it
does not register tests with anything: it runs them one after another with
`sandbox` and reports them itself (`runEntries` in the same module, the path of
`fjs t`).

### Decision proposed

Do not implement `test` natively. It stays `['error', ['notImplemented',
'test']]`, which the program decides what to do with, as for any operation the
host does not have. A native runner needs `sandbox` and the console, which it
has.

If a native host ever registers tests with a framework of its own, `test` gets a
`TestContext` of that framework then, with the nested effect run by the same
`run` over the same host.

### Tasks

- [ ] Agree that the native host leaves `test` unimplemented, and close this.

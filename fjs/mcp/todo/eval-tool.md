## Evaluate a module given as text

**Priority:** P3
**Status:** open

### Problem

An agent connected to the `fjs mcp` server cannot run FunctionalScript. The
server's tools cover the store and Evo (`cas_*`, `evo_*`). To see what a module
evaluates to, the agent has to write a file, run `fjs compile` to a `.json` and
read the result back. That needs a shell, and the server exists so an agent
does not need one.

`fjs compile` cannot answer the simplest question either. Its value outputs,
`.json` and `.data.js`, go through `_transpileDefault` in
[`fjs/fsc/transpiler`](../../fsc/transpiler/module.f.mjs), and that path
refuses an operator: `export default 2 + 2;` compiled to `.json` fails with
`an operator has no value`. The EDAG route lowers the operator. The
[memo executor](../../edag/memo/module.f.mjs) can run it. No entry point
connects the two and returns the result.

### Proposal

Add a tool that takes a module's text and returns the module's
`export default` as JSON:

| Tool       | args       | result                          |
|------------|------------|---------------------------------|
| `fjs_eval` | `{ text }` | the default export, as JSON text |

For example, `{ "text": "export default 2 + 2;" }` returns `4`.

The tool is a new registry, `fjs/mcp/eval/`, a sibling of
[`cas`](../cas/module.f.mjs) and [`evo`](../evo/module.f.mjs). That is the
extension point [`fjs/mcp/module.f.mjs`](../module.f.mjs) documents: the
composition root knows about registries, not about what is in them. The
registry is one `toolEntry` from [`fjs/protocol/mcp`](../../protocol/mcp/module.f.mjs).
The evaluation is a pure function in `fjs/fsc` that the tool calls, so a CLI
command or another front end can reuse it later without copying it.

The pipeline reuses what exists and adds no second front end or interpreter:

```text
text
  -> catch_(() =>                 (effects/common)
       parse                      (fsc/transpiler: parse(path)(text))
       -> refuse any import
       -> unresolved(module).edag (fsc/edag)
       -> _defaultExport          (fsc/edag)
       -> analysis                (edag/analysis)
       -> memo                    (edag/memo)
       -> JSON)                   (_tryJson in fsc/module.f.mjs)
  -> okResult / errorResult       (protocol/mcp)
```

A prototype confirmed the path from parsing through `memo`: `parse`, then
`unresolved(...).edag`, `_defaultExport`, `analysis` and `memo` gives `4` for
`export default 2 + 2;`. This finding does not bind the implementation.

**The first version does not resolve imports.** A module with any `import` is
refused with an error result that says imports are not supported yet. It is not
lowered with its parameter nodes left unbound, and it is not treated as if the
import were missing
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
This also keeps the tool within the server's
[design invariant](../README.md#design-invariant-the-server-never-opens-a-client-named-local-path).
An import specifier is a path the client names, and resolving one would read a
local file. Supporting imports later needs a resolution that stays inside that
invariant, such as modules named by CAS hash. It is not a matter of reusing
`resolve` in [`fjs/fsc/edag`](../../fsc/edag/module.f.mjs).

**A module can throw anywhere after `text`, not only when it runs.**
`export default null.x;` parses and lowers, and then `memo` throws the host's
`TypeError`. A call that recurses without end overflows the stack the same way.
Deep nesting overflows it before anything runs. A prototype at `4b25fe2` fed
`export default [[…]];` with nested arrays: about a thousand levels, some
2 KiB of text, threw `RangeError` in `analysis`, and a few thousand threw it in
the lowering. `parse` handled every depth tried. So the 128 KiB cap below does
not prevent it. A plain `.f.mjs` function cannot turn a throw into a result,
and an uncaught throw would end the server, not just the call. So the whole
text-to-JSON function runs as one thunk under `catch_` from
[`fjs/effects/common`](../../effects/common/module.f.mjs), not `memo` alone.
That is the host boundary `fjs/emergent_testing` already uses for user code.
It returns `ok(value)` or `error(thrown)`, and the error becomes an
`errorResult`. A parse error, an import and a JSON refusal come back inside
`ok` as the function's own `Result`. The server's operation set,
`Read | Write | MemOp | FileCasOperation` on `casMcpServer`, gains `Catch`. The
Node runner already implements `Catch`.

Catching the overflow refuses deep input. It does not remove the depth limit.
[`bound-edag-interpreter-resources.md`](../../fsc/todo/bound-edag-interpreter-resources.md)
makes validation and interpretation iterative. It does not name the lowering in
`fjs/fsc/edag` or `analysis`, and both recurse on nesting depth too. Until they
are iterative, `catch_` is the tool's whole answer to depth.

Bounding time and memory is a separate task,
[`bound-edag-interpreter-resources.md`](../../fsc/todo/bound-edag-interpreter-resources.md).
Until that lands, a module that loops forever blocks the server. The tool's
description should say so, and the argument should be capped at the same
128 KiB `maxLength` as `cas_add`'s content.

A value JSON cannot spell is refused rather than approximated. This covers
`undefined`, a bigint, `NaN`, the two infinities and a function. The tool
applies the same rules as `fjs compile`'s `.json` output, so the two agree on
what JSON means. Reuse `_tryJson` for this, exporting it properly if needed,
instead of copying it. A module with no `default` export evaluates to
`undefined` and is refused for the same reason.

**`_tryJson` does not refuse a function today.** A function falls through to
`jsonLeaf`'s default branch and is written as `null`, so
`export default x => x;` would return `null`. `fjs compile` never reaches that
branch, because its value route refuses a function before any JSON is written
(`a function has no value`). The tool does reach it, because `memo` returns the
function. So `jsonLeaf` gets a `'function'` case that refuses it
(`no JSON spelling for a function`), and the default branch is left with `null`
alone. This is one fix that serves both, not a separate check in the tool.

Every failure is an `errorResult`, a result the client reads, never a transport
error. Failures are: a parse error, an import, a throw during evaluation, and a
value JSON cannot spell. A parse error needs a name for its location because
there is no file. Use a fixed pseudo-path such as `<eval>`, so the message
reads `<eval>:line:column - error: …`, formatted by `_errorLocation` in
[`fjs/fsc`](../../fsc/module.f.mjs).

### Open questions

- **Sharing.** The memo executor keeps node identity, so
  `const a = [1]; export default [a, a];` evaluates to an array whose two
  elements are the same array. `fjs compile`'s `.json` output refuses such a
  value (`no JSON spelling for a shared node`). To stay consistent, the tool
  should refuse it too. Decide where that fact comes from on the EDAG route.
  One option is analysis's `shared` indices restricted to the constructors the
  root scope reaches.
- **Name.** The name `fjs_eval` follows the `cas_*` and `evo_*` families. The
  server's `serverInfo.name`, `functionalscript-cas`, and its README title,
  "CAS MCP server", describe a server that is no longer CAS-only once this
  lands. Renaming them is a separate decision.
- **Output format.** Other formats, such as DataJS for bigints and `undefined`,
  would need an argument. They are out of scope. JSON is the first contract.

### Tasks

- [ ] Add the text-to-value function to `fjs/fsc`: parse, refuse imports,
      lower, select the default, analyse, and run `memo`. Prove it with 100%
      coverage. The tool runs it, JSON step included, under one `catch_`.
- [ ] Add a `'function'` case to `jsonLeaf` that refuses a function, and prove
      it through `_tryJson`.
- [ ] Add the `fjs/mcp/eval` registry with the `fjs_eval` `toolEntry`, and
      compose it in `casMcpHandlers`. Add `Catch` to the server's operations.
- [ ] Prove the cases: `export default 2 + 2;` returns `4`; an object and an
      array return as JSON; a module with an import is refused; a parse error
      is reported at `<eval>:line:column`; `export default null.x;` and an
      array nested a few thousand levels deep each return an error result and
      the server keeps serving; `undefined`, a bigint and
      `export default x => x;` are refused.
- [ ] Add the tool to the tool tables in [`../README.md`](../README.md) and in
      [`fjs/mcp/module.f.mjs`](../module.f.mjs)'s JSDoc.

### Related

- [`fjs/fsc/todo/interpret-edag.md`](../../fsc/todo/interpret-edag.md): the
  memo executor this tool runs. Its open validation tasks apply to this entry
  too.
- [`fjs/fsc/todo/compile-modules-to-edag.md`](../../fsc/todo/compile-modules-to-edag.md):
  the lowering used here.
- [`fjs/fsc/todo/value-refusal-names-the-output.md`](../../fsc/todo/value-refusal-names-the-output.md):
  how a value refusal is worded, which this tool should follow.

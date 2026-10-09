## Evaluate a module given as text

**Priority:** P3
**Status:** open

### Problem

An agent connected to the `fjs mcp` server cannot run FunctionalScript. The
server's tools cover the store and Evo (`cas_*`, `evo_*`). To see what a module
evaluates to, the agent has to write a file, run `fjs compile` to a `.json` and
read the result back. That needs a shell, and the server exists so an agent
does not need one.

The compiler and interpreter are now connected.
[`compiler/transpiler.interpret(path)`](../../compiler/transpiler/module.f.mjs)
loads dependencies, lowers each module with `unresolved`, and initializes its
complete represented export object through [Memo](../../edag/memo/module.f.mjs).
Its `_transpileDefault` selects the default only after initialization and decodes
it with `toData` for JSON/DataJS output. Calls, operators and callbacks already
compute data; `export default 2 + 2;` no longer fails with the historical
`an operator has no value` refusal. See `callsAndOperators`,
`projectBeforeMaterializing` and `unusedInitialization` in the
[transpiler proofs](../../compiler/transpiler/proof.f.mjs), and operator-output
proofs in [`compiler/proof.f.mjs`](../../compiler/proof.f.mjs).

The MCP tool remains unimplemented: the
[server registry](../module.f.mjs) still contains only CAS and Evo tools.
`interpret(path)` is an effectful file/dependency loader, not a pure source-text
API. The compiler already exposes pure
[`source.parse(path)(text)`](../../compiler/source/module.f.mjs) and
[`edag.unresolved(module)`](../../compiler/edag/module.f.mjs); the reusable
text-evaluation entry and its MCP response/error contract are remaining work.

### Proposal

The following is the proposed tool contract, not an implemented API. Add a tool
that takes a module's text and returns the module's
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
The tool calls a reusable pure source-text evaluator in `fjs/compiler`, so a
CLI command or another front end can use it later. Reuse or extract the existing
per-module initialization stages rather than copying the file loader or adding
another interpreter. `compiler/proof.f.mjs` already composes pure parsing,
lowering, analysis and Memo in its `evaluate` helper; its `compileSource` helper
runs the CLI over a virtual filesystem and is not a production source-text API.

The pipeline reuses what exists and adds no second front end or interpreter:

```text
text
  -> catch_(() =>                 (effects/common)
       parse("<eval>")(text)      (compiler/source)
       -> refuse any import
       -> unresolved(module).edag (compiler/edag)
       -> analysis                (edag/analysis)
       -> memo(...)({ args: [] })  (complete represented module exports)
       -> read "default"          (edag/value/property)
       -> toData                  (edag/value/to_unknown)
       -> tryJsonStringify)       (media/datajs/serializer)
  -> okResult / errorResult       (protocol/mcp)
```

An early prototype selected `_defaultExport` before analysis and Memo and
produced `4` for `export default 2 + 2;`. The current implementation establishes
the complete module first. The proposed text evaluator must do the same: a
failure behind an unused `const` or named export still fails initialization.
Select the represented default afterward, before conversion, so an unselected
callable export does not prevent JSON output. These behaviors are pinned by
`unusedInitialization` and `projectBeforeMaterializing` in the transpiler proofs.

**The first version does not resolve imports.** A module with any `import` is
refused with an error result that says imports are not supported yet. It is not
lowered with its parameter nodes left unbound, and it is not treated as if the
import were missing
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
This also keeps the tool within the server's
[design invariant](../README.md#design-invariant-the-server-never-opens-a-client-named-local-path).
An import specifier is a path the client names, and resolving one would read a
local file. Supporting imports later needs a resolution that stays inside that
invariant, such as modules named by CAS hash. Neither the effectful
`interpret(path)` nor `edag.resolve(path)` is an appropriate source-text entry
for this tool.

**Language failures and host failures are separate.** Memo returns
`Result<EdagValue, EdagValue>`; `null.x` is a represented failure with the
payload `['undefined']`, not a host `TypeError`. The current file loader adds
the source path and `module initialization failed` diagnostic while preserving
that payload as `InitializationError.thrown`; see `initializationPayload` and
`unusedInitialization` in the transpiler proofs. The text entry must preserve
the represented failure too, and the tool must choose how to report it.

Host failures can still occur anywhere in the text-to-JSON path. A prototype
at `4b25fe2` fed `export default [[…]];` with nested arrays: about a thousand levels, some
2 KiB of text, threw `RangeError` in `analysis`, and a few thousand threw it in
the lowering. `parse` handled every depth tried. So the 128 KiB cap below does
not prevent it. A plain `.f.mjs` function cannot turn a throw into a result,
and an uncaught throw would end the server, not just the call. So the whole
proposed text-to-JSON function runs as one thunk under `catch_` from
[`fjs/effects/common`](../../effects/common/module.f.mjs), not `memo` alone.
That is the host boundary `fjs/emergent_testing` already uses for user code.
It returns `ok(value)` or `error(thrown)`, and the error becomes an
`errorResult`. Parse/import refusals, represented initialization failures,
data-conversion refusals and JSON refusals remain the function's own `Result`,
inside the successful host outcome. The server's operation set,
`Read | Write | MemOp | FileCasOperation` on `casMcpServer`, gains `Catch`. The
Node runner already implements `Catch`.

Catching the overflow refuses deep input. It does not remove the depth limit.
[`bound-edag-interpreter-resources.md`](../../compiler/todo/bound-edag-interpreter-resources.md)
gives that rewrite to two issues:
[`stack-safety.md`](../../edag/todo/stack-safety.md) for the analysis walk in
`fjs/edag/analysis`, which every executor reads, and
[`deep-nesting-recursion.md`](../../compiler/todo/deep-nesting-recursion.md) for the
compiler's own walks, the lowering in `fjs/compiler/edag` and `toDjs` in
`fjs/compiler/ast`. Until both land, `catch_` is the tool's whole answer to depth.

Bounding time and memory is a separate task,
[`bound-edag-interpreter-resources.md`](../../compiler/todo/bound-edag-interpreter-resources.md).
`catch_` alone cannot interrupt an evaluation that does not return or bound its
allocations. The proposed tool's description should state that limitation, and
the argument should be capped at the same 128 KiB `maxLength` as `cas_add`'s content.

A value JSON cannot spell is refused rather than approximated. This covers
`undefined`, a bigint, `NaN`, the two infinities and a function. The tool
applies the same rules as `fjs compile`'s `.json` output, so the two agree on
what JSON means: after `toData`, the tool's JSON step uses the already exported
`tryJsonStringify` from
[`media/datajs/serializer`](../../media/datajs/serializer/module.f.mjs).
A named-only root projects to `undefined` for value output, as
`projectBeforeMaterializing` proves, and JSON refuses it for the same reason.

**A selected callable is refused before JSON serialization.** Memo returns
represented functions, not host callables. `toData` refuses a callable anywhere
in the selected graph with
`callable materialization requires a target compile/load boundary`, the current
JSON/DataJS output refusal pinned by `outputRefusal` in the transpiler proofs.
The tool should use the same boundary. It needs no `CompileValue` operation or
runtime callable materialization; functions used during initialization can
still compute data. The DataJS reader's separate refusal of ordinary host
functions is not the boundary this pipeline reaches.

**The historical function-text blocker is resolved.** At `4b63ec0`,
`export default (x => x).toString();` evaluated to
`(a0, ...rest) => g([a0], rest)`, the source of the host factory that `memo`
materialized, not of the module's function. `'' + (x => x)` and
`[x => x].join()` gave the same text. `tryJsonStringify` wrote it as a valid string,
so the prototype would have returned a wrong answer that looked right.
Memo and Amnesia now retain code and captures as represented values; their
shared conversion renders canonical EDAG-derived, code-only function text.
Explicit `toString` and indirect array/coercion paths use that renderer, without
host arrow factories. The contract is in
[`edag/function-text.md`](../../edag/function-text.md), with direct/indirect
conversion proofs in
[`value/convert/proof.f.mjs`](../../edag/value/convert/proof.f.mjs), explicit
method proofs in
[`value/method/proof.f.mjs`](../../edag/value/method/proof.f.mjs), and Memo's
shared corpus in [`nanvm/proof.f.mjs`](../../nanvm/proof.f.mjs).
The proposed evaluator keeps these conversions represented until it obtains
the final data value. The three inputs above remain useful MCP integration
proofs; a blanket refusal of function syntax is unnecessary.

**A shared node is written where each reference reaches it.** `fjs compile`'s
`.json` output writes a node two references reach twice, as `JSON.stringify`
does — JSON carries no identity, so `const a = [1]; export default [a, a];` is
`[[1],[1]]` — and the tool follows it: its JSON step is `tryJsonStringify`'s walk over
the evaluated value, with no identity check. A call can create sharing no
syntax shows, `const a = [1]; export default [1, 2].map(x => a);` evaluates to
an array whose two elements are the same array, and the walk writes it the
same way.

Under the proposed error rules, parse/import refusals, represented initialization
failures, data/JSON refusals and caught host failures become `errorResult`s.
These tool responses still need implementation and proofs. A parse error needs
a name for its location because there is no file. Use a fixed pseudo-path such as
`<eval>`, so the message reads `<eval>:line:column - error: …`, formatted by
`errorLocation` in [`fjs/compiler/parser`](../../compiler/parser/module.f.mjs).

**A result too large to encode is the transport's failure, not the tool's.**
The input cap does not bound the output. At `940eff9`, a 420-byte module of
eighteen `const aN = aM + aM;` doublings evaluated to a string whose JSON text
is 256 KiB. [`stdioTransport`](../../protocol/mcp/stdio/module.f.mjs) answers
a response line over its 128 KiB `maxLength` with a JSON-RPC `-32603` that
keeps the request's `id`. The server stays up, but the client gets a transport
error, not an `errorResult`. That is the outcome every JSON-returning tool has
today, and [`evo/README.md`](../evo/README.md#errors) already documents it for
`evo_list` and `evo_revision`. The tool does not try to do better. Whether the
encoded response fits is known only by encoding it, and the JSON is escaped
again as MCP text content. A check in the tool would be a prediction from the
unencoded size, which this codebase does not make. The way to give the client a
readable message is
[`stdio-oversize-response-message.md`](../../protocol/mcp/todo/stdio-oversize-response-message.md),
which fixes it in the transport for every tool at once.

### Open questions

- **Reusable source-text API.** Choose the smallest compiler entry that reuses
  pure parsing, lowering and complete-module Memo initialization without
  filesystem/dependency effects. The proposed no-import policy belongs at this
  source-text boundary; it does not restrict the existing file loader.
- **Failure text.** Choose how to report represented initialization payloads
  and caught host failures while preserving the server's rule that results and
  errors carry no server filesystem paths. The compiler already preserves
  `thrown`; the new MCP result should not depend on materializing it as a host
  callable or on the host's function text.
- **Name.** The name `fjs_eval` follows the `cas_*` and `evo_*` families. The
  server's `serverInfo.name`, `functionalscript-cas`, and its README title,
  "CAS MCP server", already cover CAS and Evo. Adding evaluation broadens the
  server further; renaming it is a separate decision.
- **Output format.** Other formats, such as DataJS for bigints and `undefined`,
  would need an argument. They are out of scope. JSON is the first contract.

### Tasks

- [ ] Add the reusable source-text evaluation entry to `fjs/compiler`: parse,
      refuse imports, lower, analyse, and initialize the complete represented
      module with Memo. Preserve represented initialization failures. Prove it
      with 100% coverage, including failures behind unused initializers.
- [ ] Project the default after initialization, decode with `toData`, and reuse
      `tryJsonStringify`. Prove that selected/nested callables receive the current
      data-conversion refusal, while unselected callable exports permit JSON.
- [ ] Add the `fjs/mcp/eval` registry with the `fjs_eval` `toolEntry`, and
      compose it in `casMcpHandlers`. Add `Catch` to the server's operations and
      run the entire text-to-JSON path under one `catch_`. Implement the input
      cap and the chosen tool result/error formatting.
- [ ] Prove the cases: `export default 2 + 2;` returns `4`; an object and an
      array return as JSON; a module with an import is refused; a parse error
      is reported at `<eval>:line:column`; `export default null.x;` and an
      array nested a few thousand levels deep each return an error result and
      the server keeps serving; a root with no default, `undefined`, a bigint and
      `export default x => x;` are refused;
      `const a = [1]; export default [a, a];` and
      `const a = [1]; export default [1, 2].map(x => a);` each return
      `[[1],[1]]`; `(x => x).toString()`, `'' + (x => x)` and `[x => x].join()`
      return canonical EDAG-derived function text; a result whose response
      overflows `maxLength` gets the transport's `-32603` with the request's `id`, as
      `cas_get`'s overflow proofs pin.
- [ ] Add the tool to the tool tables in [`../README.md`](../README.md) and in
      [`fjs/mcp/module.f.mjs`](../module.f.mjs)'s JSDoc, with the oversize
      outcome in its error list.

### Related

- [`edag/function-text.md`](../../edag/function-text.md) and
  [`spec/todo/3120-parameters.md`](../../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse):
  the implemented represented function-text contract and remaining broader work.
- [`fjs/compiler/todo/interpret-edag.md`](../../compiler/todo/interpret-edag.md):
  current represented interpretation and value-output integration. Its planned
  admission entry for separately supplied EDAG is distinct from this tool's
  compiler-created graphs; those graphs preserve their invariants by construction.
- [`fjs/compiler/todo/compile-modules-to-edag.md`](../../compiler/todo/compile-modules-to-edag.md):
  the lowering used here.
- [compiler output boundary](../../compiler/README.md#ast):
  how a value refusal is worded, which this tool should follow.

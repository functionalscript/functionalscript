# Operation schemas

[RTTI](../../rtti/README.md) schemas for the data-shaped operations: for each,
the schema of its parameters and of the value its `Result` carries on success.
[`module.f.mjs`](./module.f.mjs) holds them, and [`types.ts`](./types.ts) pins
the declarations in [`../node/types.ts`](../node/types.ts) to them, so the two
cannot drift.

The shared error channel is written once, as `result`, `ioResult` and
`opResult`. Only operations whose payload is plain data are here: `mkdir`,
`readFile`, `readdir`, `writeFile`, `writeBytes`, `rm`, `write`, `read` and
`resolveFileModule`. An operation that takes a callback or an effect is outside
what an RTTI schema can describe.

These schemas describe the operations; they are not the ABI of the native
runner, which works on VM values directly. The RTTI guide's
[effects page](../../rtti/guide/in-the-project/effects/README.md) shows them in
use.

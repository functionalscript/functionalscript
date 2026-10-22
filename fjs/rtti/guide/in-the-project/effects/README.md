# Effects

**Status:** implemented

[`effects/schema`](../../../../effects/schema/module.f.mjs) describes
data-shaped effect requests and results, such as the entries `readdir`
answers, for validation. Its [`types.ts`](../../../../effects/schema/types.ts)
checks the corresponding handwritten TypeScript declarations against the types
[`Ts<>`](../../outputs/typescript/README.md) derives from the schemas.

These schemas are not a native runner ABI or the complete native effect set;
that set follows [`effects/node/`](../../../../effects/node/) within the
[native scope](../../../../../todo/nanvm-effects-node-operations.md).

## Examples

The demo on this page offers one schema, a directory entry, with a value it
accepts. It is defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Where it is implemented

[`effects/schema`](../../../../effects/schema/module.f.mjs).

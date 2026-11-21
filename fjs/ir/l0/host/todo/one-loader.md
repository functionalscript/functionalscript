## One loader for an emitted module

**Priority:** P3
**Status:** open

### Problem

[L0 design §5](../../../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)
gives the loader a job: read `fjs.layout`, make a host with that much data
and that many table entries, instantiate the module on the host's
`fjs:l0` imports and on `fjs:l1-native`, call `init` where the module has
one, and `keep`. No module owns that job. It is written out where it is
needed:

- `run` in [`fjs/ir/wasm/testlib.mjs`](../../../wasm/testlib.mjs), once
  for every row of inputs:

  ```js
  const h = host(values, data, entries)
  const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': h.imports, 'fjs:l1-native': h.native ?? nativeHost(h.read, h.own, h.fail) })
  const { init } = exports
  if (typeof init === 'function') { init() }
  h.keep()
  ```

- `onHost` in
  [`doc/sasha-gil/ir/benchmark.run.mjs`](../../../../../doc/sasha-gil/ir/benchmark.run.mjs),
  the same five lines, and a `compile` beside it that is `run`'s first
  four: `check`, `emit`, `write`, `new WebAssembly.Module`.
- `load` in [`count/proof.mjs`](../count/proof.mjs) and `leftAfter` in
  [`fjs/ir/lifetime/proof.mjs`](../../../lifetime/proof.mjs), the short
  form: no layout, no native rows, no `init`. A subject that grows a
  literal or a constant needs the long form and has to notice.

The rule that a host without native rows of its own gets the JavaScript
ones, `h.native ?? nativeHost(h.read, h.own, h.fail)`, is the
[`Counting`](../types.ts) type's own remark and is spelled at both long
sites.

The reader of `fjs.layout` is a test library's export. `layoutOf` and its
private `ulebs` live in `fjs/ir/wasm/testlib.mjs`, and the benchmark and
`count/proof.mjs` import the test library to get them. The section's
writer, `layout` in [`fjs/ir/wasm/module.f.js`](../../../wasm/module.f.js),
and its reader share nothing: the writer emits
`[...uleb(data), ...uleb(0), ...uleb(entries)]` and the reader destructures
`[data = 0, , entries = 0]`, so the order of the three numbers is stated
twice, in two languages' worth of files, and a fourth number is an edit to
both.

LEB128 itself is written four times: `leb` in
[`media/wasm/binary/write`](../../../../media/wasm/binary/write/module.f.js)
and in [`media/wasm/binary/parse`](../../../../media/wasm/binary/parse/module.f.js),
both private, `uleb` in `fjs/ir/wasm/module.f.js`, and `ulebs` in the test
library.

### Proposal

Two pieces, either of which stands without the other.

**The layout as a codec, in FunctionalScript.** `fjs/ir/wasm/layout` (or
exports of `fjs/ir/wasm`) holds the section's name, a `Layout` type of
`data` and `entries`, `encode: Layout => Custom` and
`decode: Bytes => Layout`, so the order of the numbers has one owner and a
proof round-trips it. `media/wasm/binary` exports the unsigned LEB128
writer and reader that it already has, and `uleb` and `ulebs` go.

**The loader, in the host directory.** A `load` beside the hosts, the one
`.mjs` that touches `WebAssembly.Instance` for an emitted module:

```js
// (make: (values, data, entries) => Counting) => (compiled: WebAssembly.Module, values) => { exports, host }
```

It reads the layout through `decode`, makes the host, picks the native
rows, instantiates, runs `init` and keeps. `run`, the benchmark's `onHost`
and the two short proofs call it. The benchmark then imports a loader
rather than a test library, which is the dependency a script under `doc/`
should have.

### Drawbacks

`run` makes a host per row of inputs and reads the layout once per module,
so `load` takes the compiled module and decodes per call, or is curried
over the module. The first is simpler; the cost is a few bytes read again.

### Related

- [the slices](../../../todo/slices.md), where 12d made the loader the
  maker of the table.
- [the counting host's state](../count/todo/counting-state-in-fjs.md)

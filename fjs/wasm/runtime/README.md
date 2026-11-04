# WASM runtime

`fjs/wasm/runtime` is the runtime of the WASM execution mode of
FunctionalScript: the layers a compiled program calls across the WASM module
boundary, as the design notes in
[`doc/sasha-gil/wasm`](../../../doc/sasha-gil/wasm/README.md) lay them out.
The interpreter and the Rust backend do not use it, and
[`fjs/js/runtime`](../../js/runtime/README.md) stays as it is.

|Layer|What it holds|Imported by|
|-|-|-|
|[`l0`](./l0/module.f.js)|the FunctionalScript view of the L0 core, with JavaScript bodies|`l1`, its one importer|
|[`l1`](./l1/module.f.js)|the L1 operations with FunctionalScript bodies, and its [native rows](./l1/native/module.f.js)|none yet; the WASM backend will compile it|

L2, the stock runtime, will join here as `l2`.

Until a WASM backend exists, every body runs on a JavaScript host, so the
layers are proved before any WASM is generated.

# WASM runtime

`fjs/wasm/runtime` is the runtime of the WASM execution mode of
FunctionalScript: the layers a compiled program calls across the WASM module
boundary, as the design notes in
[`doc/sasha-gil/wasm`](../../../doc/sasha-gil/wasm/README.md) lay them out.
The interpreter and the Rust backend do not use it, and
[`fjs/js/runtime`](../../js/runtime/README.md) stays as it is.

|Layer|What it holds|Imported by|
|-|-|-|
|[`l0`](./l0/module.f.js)|the FunctionalScript view of the L0 core, with JavaScript bodies|`l1`, `l1/native` and `l1/builtin`; in [`fjs/ir`](../../ir/README.md), the lowering, which reads its kinds, the host of the `fjs:l0` imports, which are its functions, and the originals that the proofs lower|
|[`l1`](./l1/module.f.js)|the L1 operations with FunctionalScript bodies, and its [native rows](./l1/native/module.f.js)|`l1/builtin`; in `fjs/ir`, the host of the `fjs:l1-native` imports, which are the rows, and the host proofs, which lower the bodies that the slices name from L1's text and run them as WASM against L1's own|
|[`l1/builtin`](./l1/builtin/module.f.js)|today's natives as L1 bodies: `slice`, `String.fromCharCode`, `Object.entries`, `entry`, `hasEntry` (`charCodeAt` is L1's own method call since #4063)|none yet: `fjs/ir`'s lowering does not take these natives yet; when it does, it binds the names to them|
|[`l1/error`](./l1/error/module.f.js)|the values L1 throws, copied by name from NaNVM's `error.rs`; nothing checks the texts across the two|`l1`, `l1/native`, `l1/builtin`; in `fjs/ir`, the lowering, which reads the table from its text, and the proofs|

L2, the stock runtime, will join here as `l2`.

Every body runs on a JavaScript host, so each layer is proved before WASM
runs it. [`fjs/ir`](../../ir/README.md), the code IR and its WASM
backend, compiles L1's bodies a slice at a time
([todo/slices.md](../../ir/todo/slices.md)) and runs each as WASM against
its body here, over a JavaScript host of the L0 imports, and since
slice 12 over NaNVM built as a `.wasm`.

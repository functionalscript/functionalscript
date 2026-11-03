# L2: the stock runtime

The stock runtime is the built-ins a program reaches through the `runtime`
value: the statics, such as `Object.is` and `Number.isInteger`, and the
member bodies, such as `startsWith`. These notes read "stock runtime
building ops" as that set. If a narrower set was meant, such as only the
natives, this note changes.

[l2-design.md](./l2-design.md) is a first detailed design.

## Today

[`fjs/js/runtime/module.f.js`](../../../fjs/js/runtime/module.f.js) holds
the `statics` and `member` tables and exports `runtime`: `static`, `dot` and
`in`. It is compiled by the ordinary Rust backend into
[`gen.runtime.rs`](../../../nanvm/lib/src/vm/gen.runtime.rs), which calls the
same `Any` operations as user programs. Below it are a few Rust natives:
`Object.entries`, `String.fromCharCode`, and the native member table, which
answers `charCodeAt` and `slice`
([`member_access.rs`](../../../nanvm/lib/src/vm/member_access.rs)).

A module reads a static at run time by a string,
`static_read(&runtime, "Object.is")`.

## Proposed

- **L2 is a module of its own, built by our compiler.** Through the WASM
  backend, `fjs/js/runtime` becomes a `.wasm` that imports L1 and L0 like
  any program. An alternative runtime gets the whole stock runtime for free.
- **The natives move into L1.** `charCodeAt`, `slice`,
  `String.fromCharCode` and `Object.entries` are what L2 cannot write in
  FunctionalScript. They are operations, not built-ins, so they join the L1
  list, with reference bodies where one can be written.
- **Statics link by name, once.** A static becomes an import, such as
  `(import "fjs:static" "Object.is" ...)`, resolved when the modules are
  linked. The `runtime` value stays only for member dispatch,
  `runtime.dot`, which depends on the receiver and so is dynamic.

## Open

The [L2 design](./l2-design.md) proposes an answer to both: one stock module
with L1, and substitution by our linker.

- Whether L2 is one module or one module per table.
- How a runtime that implements a static natively, as NaNVM does for
  `Object.entries`, overrides the L2 body at link time.

# NaNVM's two-value results, through adapter modules

How NaNVM, a Rust runtime, gives a program the two-value results that the
[L0 design](./l0-design.md) asks for, on stable Rust. `call` and every
function's code return a status and an `any`
([choices 12 and 13](./l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
L0 does not change.

## The problem

Stable Rust can't produce the two shapes NaNVM needs:

- the `call` export, of type `(i64, i64) -> (i32, i64)`;
- a `call_indirect` of that type, from inside `call`, into the program's
  code in the shared table.

These are the WASM types that Rust 1.99.1 compiles each source shape to,
for `wasm32-unknown-unknown` with `-C target-feature=+multivalue`:

| Rust source | WASM type |
| --- | --- |
| `extern "C" fn call(f: i64, a: i64) -> R`, where `R` is a `#[repr(C)]` pair | `(i32, i64, i64) -> ()` |
| `fn call(f: i64, a: i64) -> (i32, i64)`, the Rust ABI | `(i32, i64, i64) -> ()` |
| a call through a pointer of type `fn(i64, i64) -> (i32, i64)` | a `call_indirect` of type `(i32, i64, i64) -> ()` |

In every case the pair goes through a hidden pointer into memory.
`extern "wasm"`, the ABI that returned a pair as two values, was removed in
Rust 1.81 ([rust-lang/rust#127605](https://github.com/rust-lang/rust/pull/127605)).
Nightly can still write the two functions in WASM assembly through
`global_asm!`, but that ties the runtime to an unstable feature, so it is
not used.

## The pick: split in two in Rust, joined in two small modules

NaNVM, on stable Rust, splits each two-value call into two one-value
calls. The first answers the status and the second answers the value,
which the callee keeps in a global until it is read. Two adapter modules
join the halves back into L0's types. Both are built from
[`fjs/wasm/nanvm`](../../../fjs/wasm/nanvm/module.f.mjs) with
`fjs/media/wasm`:

```
program ──call──▶ outbound ──call_status, call_value──▶ NaNVM
                                                         │
program code ◀──call_indirect── inbound ◀──invoke, invoke_value──┘
```

- **`inbound`** is imported by NaNVM as `fjs:nanvm-inbound`. It imports the
  shared table and exports `invoke(code, self, args) -> status`, which
  calls the program's code through the table and keeps the value, and
  `invoke_value() -> any`.
- **`outbound`** is the module the program imports `call` from, in NaNVM's
  place. It imports NaNVM's `call_status(f, args) -> status` and
  `call_value() -> any`, and exports `call(f, args) -> (status, any)`.

The NaNVM side, in stable Rust:

```rust
#[link(wasm_import_module = "fjs:nanvm-inbound")]
unsafe extern "C" {
    fn invoke(code: i32, self_: i64, args: i64) -> i32;
    fn invoke_value() -> i64;
}

#[unsafe(no_mangle)]
pub extern "C" fn call_status(f: i64, args: i64) -> i32 { /* ... */ }

#[unsafe(no_mangle)]
pub extern "C" fn call_value() -> i64 { /* ... */ }
```

There are two modules, not one, because NaNVM imports `inbound` and
`outbound` imports NaNVM. One module would make a cycle that no loader can
instantiate. The loader instantiates the program's dependencies in this
order: `inbound`, NaNVM, `outbound`, and then the program. Every other
L0 import goes from NaNVM to the program directly.

**A value is read right after its status.** Between `invoke` and
`invoke_value`, and between `call_status` and `call_value`, nothing else
runs. So one global on each side is enough, even when calls nest:
a nested call finishes before its caller reads its own value.

## Checked

The proofs in `fjs/wasm/nanvm` check that both modules write and read back
as themselves, and they check `invoke`'s code. A probe linked the four
modules in node 22:

- `inbound` and `outbound`, written by `fjs/media/wasm`;
- a NaNVM stand-in built with stable Rust 1.99.1, whose exports are
  `call_status: (i64, i64) -> (i32)` and `call_value: () -> (i64)`;
- one program function of L0's code type, placed in the table.

`outbound.call(0n, 20n)` ran that program function through `invoke` and
answered `[1, 40n]`, as the stand-in computes.

## Costs

- One more call per two-value call, plus one global write and one read on
  each side. An inliner can remove both later, since every adapter function
  is a few instructions long.
- The loader links two more modules, which only NaNVM needs.
- The table's import name, `fjs:loader` `table`, is provisional:
  [choice 5](./l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)
  doesn't name it yet.

## Alternatives

- **(C) The two functions in WASM assembly, inside the crate**, through
  nightly's `asm_experimental_arch`. There is no extra module, but the
  `.wasm` build would need a nightly toolchain and an unstable feature.
  It was proposed in #3633 and declined.
- **(B) Change L0 so no runtime needs two results**, for example by
  having `call` answer the value and set a status global. That changes L0
  for every runtime because of one Rust limitation.
- **(D) WASM exceptions** for a throw, the later alternative in
  [choice 13](./l0-design.md#13-errors-an-i32-status-and-an-any). This
  needs WASM 3.0, and Rust on `wasm32` can't catch a foreign exception tag
  on stable.

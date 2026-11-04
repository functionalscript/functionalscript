# NaNVM and L0's two-value results

A design suggestion for review. It fits NaNVM, a Rust runtime, to one part
of the [L0 design](./l0-design.md): `call` and every function's code return
two values, a status and an `any`
([choices 12 and 13](./l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
Nothing here changes L0.

## The problem

NaNVM has to produce two shapes that carry two results:

- the export `call`, of type `(i64, i64) -> (i32, i64)`;
- a `call_indirect` of that same type, from inside `call`, into the
  program's code in the shared table.

Stable Rust produces neither. Checked with Rust 1.99.1 and a nightly from
2026-11-02, for `wasm32-unknown-unknown`, with `-C target-feature=+multivalue`:

| Rust source | WASM type it compiles to |
| --- | --- |
| `extern "C" fn call(f: i64, a: i64) -> R`, `R` a `#[repr(C)]` pair | `(i32, i64, i64) -> ()` |
| `fn call(f: i64, a: i64) -> (i32, i64)`, the Rust ABI | `(i32, i64, i64) -> ()` |
| a call through a pointer of type `fn(i64, i64) -> (i32, i64)` | a `call_indirect` of type `(i32, i64, i64) -> ()` |

The pair always travels through a hidden pointer into memory. The
`multivalue` feature lets LLVM emit multi-value code, but rustc's ABIs
return any aggregate indirectly, so the feature never applies.

`extern "wasm"`, the ABI that returned an aggregate as several values, was
removed in Rust 1.81
([rust-lang/rust#127605](https://github.com/rust-lang/rust/pull/127605)).
No current toolchain has it, nightly included.

## Suggestion: the two functions in WASM assembly, inside the crate

Nightly Rust's `asm_experimental_arch` feature allows `global_asm!` on
`wasm32`. A function written there declares its own type, with two results,
and calls the Rust code around it. The status's value travels through a
Rust global, written just before the return:

```rust
#![feature(asm_experimental_arch)]

static mut OUT: i64 = 0;

#[unsafe(no_mangle)]
pub extern "C" fn call_c(f: i64, args: i64) -> i32 {
    // ... the real `call`; it writes the value to OUT and answers the status
}

#[unsafe(no_mangle)]
pub extern "C" fn out() -> i64 { unsafe { OUT } }

core::arch::global_asm!(
    ".globl call", ".type call,@function", "call:",
    ".functype call (i64, i64) -> (i32, i64)",
    "local.get 0", "local.get 1", "call call_c", "call out",
    "end_function",
    ".export_name call, call",
);

// The typed call into the program's code in the shared table.
core::arch::global_asm!(
    ".globl invoke", ".type invoke,@function", "invoke:",
    ".functype invoke (i32, i64, i64) -> (i32, i64)",
    "local.get 1", "local.get 2", "local.get 0",
    "call_indirect (i64, i64) -> (i32, i64)",
    "end_function",
);
```

A probe of this, built with the nightly above, exports
`call: (i64, i64) -> (i32, i64)` and `invoke: (i32, i64, i64) -> (i32, i64)`,
and node 22 runs `call(1n, 42n)` to `[1, 42n]`. Rust still needs a way to
receive `invoke`'s two results. A second assembly function does that: it
calls `invoke`, stores the `i64` to `OUT` and returns the `i32`, which Rust
can call as a plain `extern "C"` function.

**What it costs:**

- **A nightly toolchain** for NaNVM's `.wasm` build only. The native build,
  the tests and every other crate stay on the pinned stable Rust. The
  feature is unstable, so its syntax can change.
- One store and one load per call, through `OUT`, until an inliner removes
  them.
- About two dozen lines of WASM assembly to review by hand.

`RUSTC_BOOTSTRAP=1` also compiles the probe on stable 1.99.1. That
unlocks unstable features on a stable compiler, and the Rust project
asks people not to use it outside the compiler's own build. So it is
listed here, not suggested.

## Alternatives

- **(A) A separate adapter module.** The same few functions, as a small
  WASM module of their own, made with `fjs/media/wasm`, between NaNVM and
  the program. Stable Rust, and the same costs otherwise. The loader links
  one more module, which only NaNVM needs.
- **(B) Change L0 so no runtime needs two results.** For example, `call`
  answers the value and sets a status global. This changes L0 for every
  runtime because of one Rust limitation.
- **(D) WASM exceptions** for a throw, the later alternative in
  [choice 13](./l0-design.md#13-errors-an-i32-status-and-an-any). This
  needs WASM 3.0, and Rust on `wasm32` cannot catch a foreign exception tag
  on stable.

## Questions for review

1. Is a nightly toolchain acceptable for NaNVM's `.wasm` build, while
   everything else stays on stable? If not, A gives the same result on
   stable.
2. Should the status's value go through a Rust global, as here, or should
   the assembly function take a pointer to the program's scratch space?

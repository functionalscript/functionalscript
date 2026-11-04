# A throw that traps: one-value results for L0

A design suggestion for review. It is option D among the ways to give NaNVM L0's
two-value results (#3639's `nanvm-adapter.md`), using a trap, which
is what a Rust panic compiles to, instead of WASM exceptions. Unlike the
adapter design, it changes L0: choices
[12](./l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text),
[13](./l0-design.md#13-errors-an-i32-status-and-an-any) and
[20](./l0-design.md#20-a-program-is-one-module-with-an-init-export).

## Why a trap is enough

L0 returns `(i32, any)` so that a caller can tell a throw from a result and
go on. But a FunctionalScript program never catches a throw. The language
has `throw` and no `try`. Only the host catches, through the `catch` and
`sandbox` effects (`fjs/effects/common`): the host runs a thunk and answers
`ok(v)` or `error(e)`. So a throw only has to reach the host, and every
frame between the `throw` and the host can be abandoned.

A WASM trap does exactly that. It also needs nothing beyond WASM 2.0, and
stable Rust on `wasm32-unknown-unknown` emits it for every panic.

## The suggestion

- **Code and `call` have one result.** All code has the type
  `(param $self i64) (param $args i64) (result i64)`, and `call(f, args)`
  answers `any`. The program no longer branches after each call.
- **L0 gets `throw(v)`.** It takes the value, keeps it, and traps. The
  program emits `call $throw` followed by `unreachable` where it throws,
  and L1 throws its `TypeError` and other errors the same way.
- **`init` answers `any`.** A module's top level that throws traps like
  any other code.
- **The host reads the throw.** When a call from the host into the program
  traps, the host asks the runtime's `thrown()`, a host-only export,
  not an L0 import. It answers the value kept by the last `throw` and
  clears it. If nothing was thrown, the trap was a misuse (choice 11), a
  bug and not a throw, so the host stops.
- **A runtime in JavaScript** throws a JavaScript exception instead. It
  crosses the WASM frames to the host, which sees the same value.

**The host can go on after a throw.** For `catch` and `sandbox`, the host
answers `error(e)` and calls the continuation on the same instance. The
abandoned frames never run their `drop`s, so the values they held leak.
A caught throw costs memory but never correctness, because nothing reads
those values again. Before it goes on, the host calls the runtime's
`recover()`, also host-only, which closes any builder that a frame left
open.

**NaNVM throws only where its own state is whole.** Its Rust code keeps
returning `Result` inside, and calls `throw` only at an export, where it
holds no borrow and no half-built value. So a trap never leaves a
`RefCell` borrowed or an object half made.

## Checked

A NaNVM stand-in built with stable Rust 1.99.1 and `-C panic=abort`
exports `throw: (i64) -> ()`, `call: (i64, i64) -> (i64)` and
`thrown_flag` / `thrown_value`, the probe's spelling of `thrown`. In node
22:

- `call(2n, 10n)` answers `5n`;
- `call(0n, 42n)` throws `42n`. The host catches a `RuntimeError`
  (`unreachable`), and `thrown_flag()` and `thrown_value()` answer `1`
  and `42n`;
- the same instance keeps working after that trap.

`throw` is written as a store and `core::arch::wasm32::unreachable()`. A
`panic!` after the store gives the same trap, but it brings the panic
formatting code into the module.

## Compared with the adapter design

| | Adapter modules (A) | A throw that traps (D) |
| --- | --- | --- |
| L0 | unchanged | code, `call` and `init` have one result; `throw` added |
| Every call | the status is tested after it returns | nothing is tested |
| NaNVM build | stable Rust and two adapter modules | stable Rust only |
| A caught throw | every `drop` runs | the abandoned frames' values leak |
| A future `try` in the language | works as it is | needs WASM exceptions then |

## Risks

- **A `try` statement.** If FunctionalScript gains `try`/`catch`, a
  program would catch inside WASM, and only WASM exceptions can do that
  without leaks. The trap design stays correct for the host-side `catch`
  effect, and `try` would be a new ABI version.
- **Leaks under `catch`.** A program that catches many throws in one run
  grows its memory. Today's `catch` and `sandbox` users make one call per
  effect, so the leak is a frame's worth per caught throw.
- **Hosts other than node.** Wasmtime also keeps an instance usable after
  a trap. That is not checked here.

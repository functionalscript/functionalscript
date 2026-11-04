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
  traps, the host asks two host-only exports of the runtime, not L0
  imports. `has_thrown() -> i32` answers 1 when a `throw` caused the trap,
  and `thrown() -> any` answers its value. A flag apart from the value is
  needed because a program may `throw undefined`. If `has_thrown()`
  answers 0, the trap was a misuse (choice 11), a bug and not a throw, so
  the host stops.
- **A runtime in JavaScript** throws a JavaScript exception instead, an
  instance of a class private to the runtime that holds the value. It
  crosses the WASM frames to the host. The host answers `error(v)` only
  for that class. Any other exception, such as an L0 precondition the
  runtime checks, is a misuse, because a program's own thrown value can
  never be an instance of the private class.

**The host can go on after a throw.** For `catch` and `sandbox`, the host
answers `error(e)` and calls the continuation on the same instance. The
abandoned frames never run their `drop`s, so the values they held leak.
A caught throw costs memory but never correctness, because nothing reads
those values again. Before it goes on, the host calls the runtime's
`recover()`, also host-only. It closes any builder that a frame left
open and clears `has_thrown()`.

**The shadow stack is restored too.** Rust keeps a stack in linear memory
whose top is the mutable global `__stack_pointer`, and a trap skips the
epilogues that would raise it again. Left as it is, every caught throw
loses the stack that the abandoned Rust frames reserved, until a later
valid call runs out and traps. So the runtime exports the global, through
the linker's `--export=__stack_pointer`, which stable Rust supports. The
host reads it before each call into the program and writes it back after
a caught trap. Stable Rust cannot write that global itself, which is why
the host does it and `recover()` does not. A runtime that keeps no stack
in linear memory exports no such global, and the host skips the step.

**NaNVM throws only where its own state is whole.** Its Rust code keeps
returning `Result` inside, and calls `throw` only at an export, where it
holds no borrow and no half-built value. So a trap never leaves a
`RefCell` borrowed or an object half made.

## Checked

A NaNVM stand-in built with stable Rust 1.99.1 and `-C panic=abort`
exports `throw: (i64) -> ()`, `call: (i64, i64) -> (i64)` and
`thrown_flag` / `thrown_value`, the probe's spelling of `has_thrown` and
`thrown`. In node
22:

- `call(2n, 10n)` answers `5n`;
- `call(0n, 42n)` throws `42n`. The host catches a `RuntimeError`
  (`unreachable`), and `thrown_flag()` and `thrown_value()` answer `1`
  and `42n`;
- the same instance keeps working after that trap.

A second stand-in reserves 4 KiB of Rust stack in `call`. Without the
restore, each caught throw lowers `__stack_pointer` by 4,112 bytes, and
the 255th caught throw traps with `memory access out of bounds`. With the
host writing the saved value back, 100,000 caught throws leave it where it
started, and `call(2n, 10n)` still answers `5n`.

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
- **Leaks under `catch`.** A trap abandons every frame between the
  `throw` and the host's call, not only one. So a caught throw leaks
  everything those frames held, which is unbounded for a deep recursion
  with large temporaries. A program that catches many throws in one run
  grows its memory by that much each time.
- **Hosts other than node.** Wasmtime also keeps an instance usable after
  a trap. That is not checked here.

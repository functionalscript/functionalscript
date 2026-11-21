# Benchmark: IR programs on NaNVM's `.wasm`

Measured 2026-11-21, after slice 12 ([`fjs/ir/todo/slices.md`](../../../fjs/ir/todo/slices.md)):
how fast untyped FunctionalScript programs run when the IR lowers them to
WASM and NaNVM's `.wasm` is their runtime, beside the counting host and
JavaScript itself, and where the time goes. This is a measurement, not a
decision. The levers at the end are proposals.

The code is in this folder: [benchmark.programs.mjs](./benchmark.programs.mjs)
holds the untyped programs, [benchmark.typed.mjs](./benchmark.typed.mjs) two
typed twins, and [benchmark.run.mjs](./benchmark.run.mjs) the runner. See
[Running it](#running-it).

## Summary

- **Untyped programs on NaNVM's `.wasm` run 50× to 1,400× slower than
  JavaScript.** NaNVM is 1.1× to 2.7× faster than the counting host.
- **The typed twins run as plain WASM about 8× faster than JavaScript.**
  The emitter is fine when types are known.
- **94% of an untyped numeric loop is NaNVM's handle layer**, the L0 ABI
  in [`nanvm/lib/src/l0/abi.rs`](../../../nanvm/lib/src/l0/abi.rs), not the
  program or L1. The program and the L1 bodies take 3% to 6% of the time.
- **Two things multiply.** L1 makes about 20 L0 calls for one `<` of a
  number and an `any`, and each L0 call costs 12 to 25 ns on NaNVM. A
  record of `any` is a Containers object, so every loop step builds one and
  reads its fields through `l1.get`.

## Setup

- A cloud container: 4 cores of an Intel Xeon at 2.1 GHz, Node 26.13.1.
  NaNVM's `.wasm` is built with `--release` for `wasm32-unknown-unknown`,
  from branch `claude/project-thread-gnbpyt-12d` (#4043).
- Each time is the median of batches of 10 calls after a warm-up. Each
  cell below is the median of three runs. JavaScript's times vary by about
  ±30% between runs, and the WASM ones by about ±5%.
- Every argument is a value of `any`, made by the host before timing. A
  call includes reading its result back and dropping it.
- Each program is checked against JavaScript's answer before it is timed.

## The programs

Each is a `while` loop over a record state, the only loop form that the
lowering takes today:

| Program | Loop body, `n` steps |
| --- | --- |
| `sumTo(n)` | `{ i: s.i + 1, acc: s.acc + s.i }`, state `f64` (the literals type it), only `s.i < n` touches `any` |
| `sumToAny(n)` | the same, with the whole state of `any` |
| `fib(n)` | `{ i, a: s.b, b: s.a + s.b }`, state `f64`, n = 70 |
| `readFields(o, n)` | `acc + o.x * o.y`, state of `any` |
| `callMany(f, n)` | `acc = f(acc, i)`, where `f` is a JavaScript function, n = 1,000 |
| `repeat(n, e)` | `t = t + 'ab'`, a string of 2,000 units at the end, n = 1,000 |
| `bigSum(n, one)` | `acc + i * i` on bigints, n = 1,000 |

`n` is 10,000 unless the table says otherwise.

## Times

| Program | JavaScript | Typed IR as WASM | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 52 µs | 6.1 µs | 3.64 ms | 9.74 ms | 69× | 2.7× |
| `sumToAny` | 63 µs | | 52.7 ms | 107 ms | 841× | 2.0× |
| `fib` | 0.5 µs | 50 ns | 25.6 µs | 57.5 µs | 51× | 2.2× |
| `readFields` | 50 µs | | 66.2 ms | 139 ms | 1,320× | 2.1× |
| `callMany` | 5.2 µs | | 6.17 ms | 10.2 ms | 1,187× | 1.6× |
| `repeat` | 5.4 µs | | 7.80 ms | 8.78 ms | 1,444× | 1.1× |
| `bigSum` | 12 µs | | 7.06 ms | 10.1 ms | 603× | 1.4× |

One step of `sumTo` on NaNVM takes 364 ns. One step of `sumToAny` takes
5.3 µs.

## Where the time goes

### L0 calls per program

From the `calls` mode. The module's literals, made once by its start
function, are left out.

| Program | L0 calls | Per step | Most called |
| --- | --- | --- | --- |
| `sumTo` | 200,022 | 20 | `kind` 80,008, `drop` 50,006, `dup` 40,004, `to_f64` 20,002, `from_f64` 10,002 |
| `sumToAny` | 1,560,084 | 156 | `kind` 650,033, `drop` 350,018, `dup` 270,016, `to_f64` 100,006, `from_f64` 70,003 |
| `readFields` | 2,000,084 | 200 | `kind` 840,033, `drop` 450,018, `dup` 330,016, `to_f64` 140,006, `from_f64` 100,003 |
| `bigSum` | 137,057 | 137 | `kind` 68,025, `drop` 30,012, `dup` 25,012, `find` 5,002, `item` 5,002 |

In `sumTo` the only operation on `any` is `s.i < n`. The lowering boxes
`s.i` with `from_f64`, calls `l1.lessThan`, and drops the box. `lessThan`
runs `toPrimitive` on both sides, reads both kinds, tests for strings and
bigints, then runs `toNumber` on both. That is 20 L0 calls, 8 of them
`kind`, to compare two numbers.

In `sumToAny` the state `{ i, acc }` is a Containers object, as slice 8c
lowers an object literal of `any`. Each step builds one with
`begin_object`, two `push_property` and `seal`, and reads it with four
`l1.get` calls, each a `find` and an `item`. The lowered code also has
`dup`/`drop` pairs that cancel: a `match` that casts a sealed object dups
it and then drops the original, and `toPrimitive` answers its own argument
as an owned value.

### The cost of one L0 call

From the `l0` mode: the calls are made from JavaScript, so each includes
the JavaScript-to-WASM hop, which is the first row.

| L0 call | NaNVM's `.wasm` | Counting host |
| --- | --- | --- |
| `from_bool(1)`: a constant, the hop alone | 2.4 ns | 8.3 ns |
| `kind` of a number | 15.1 ns | 16.0 ns |
| `kind` of an object | 20.5 ns | 23.5 ns |
| `to_f64` | 14.9 ns | 16.0 ns |
| `from_f64`, then `drop` | 27.5 ns | 132.8 ns |
| `dup` of a string, then `drop` | 46.3 ns | 116.2 ns |

A handle is an index into a slab of Rust `Any` values. Every call enters
the thread-local state through `with`, which sets and clears the busy flag,
checks the slot's generation, and, for `kind` and `to_f64`, clones the
`Any` out of its slot and drops the clone. A number takes a slot of its
own, so `from_f64` allocates one and `drop` frees it.

### Profile

From `node --cpu-prof` on the `nanvm` mode, self time grouped by where it
is spent. The harness and compile time are left out.

| Program | NaNVM's handle layer | NaNVM objects and strings | NaNVM's allocator | NaNVM, other | The program and L1 bodies |
| --- | --- | --- | --- | --- | --- |
| `sumTo` | 94% | | | | 6% |
| `sumToAny` | 62% | 24% | 6% | 5% | 4% |
| `readFields` | 64% | 21% | 6% | 5% | 4% |
| `bigSum` | 58% | 25% | 6% | 8% | 3% |

The handle layer is `with`, the slab, and the clone and drop of `Any`. The
grouping is by symbol name, so the split between the first two columns is
approximate.

### A small check

Making `kind` and `to_f64` borrow the slot's value instead of cloning it
(two functions in `abi.rs`) took `kind` of a number from 15.1 to 8.5 ns and
`to_f64` from 14.9 to 7.5 ns. `sumTo` went from 3.6 to 2.5 ms, and
`sumToAny` from 52 to 44 ms. The change was reverted after the
measurement. It is not in any branch.

## Levers

Ordered by how much each would gain for its cost, as the numbers above
suggest. Each is a proposal. None has been started.

1. **Borrow in the read-only L0 calls.** `kind`, `to_f64`, `to_bool`,
   `length`, `find` and the other read-only calls in `abi.rs` would read
   the slot instead of cloning `Any`. This is the check above: about 30% on
   `sumTo`. It is small, and it stays inside NaNVM's ABI.
2. **Fast paths for numbers in L1.** `lessThan`, `add` and the other
   operators would test for two numbers first and answer with one WASM
   instruction, before `toPrimitive`. Where the lowering already knows
   that one side is `f64`, as in `sumTo`, it would test only the other
   side's kind and skip the box. That takes `s.i < n` from 20 L0 calls to
   2 (`kind` and `to_f64`), which at about 8 ns each would make `sumTo`
   about 5× to 10× faster. This is an estimate, not a measurement. It
   helps the counting host as much.
3. **Records of `any` stay records.** A record that does not escape, such
   as a loop's state, would be IR fields of `any` instead of a Containers
   object. That removes the build and the four `l1.get` calls per step in
   `sumToAny` and `readFields`, about half of their L0 calls and most of
   their time in objects. It also lifts the refusal of a state that mixes
   `f64` and `any` (below).
4. **Cancel `dup`/`drop` pairs in the lifetime pass.** One pair costs about
   46 ns on NaNVM. The cast after `seal` and `toPrimitive`'s answer are the
   two seen here.
5. **NaN-boxed handles.** The handle would be the NaN box's bits, as
   [type-system.md](./type-system.md) and
   [nan-box-in-ir.md](./nan-box-in-ir.md) lay them out, so a number or a
   constant needs no slot, and `kind`, `to_f64` and `from_f64` become a
   few instructions that the module can inline. This is the largest gain
   for numeric code, and the largest change: NaNVM's ABI, its misuse
   checks and the inline fragments of
   [`../wasm/inline-fragments.md`](../wasm/inline-fragments.md). Levers 2
   and 3 shrink what is left for it to do, so they come first.

Two smaller points:

- `callMany` calls a JavaScript function, so each step crosses from WASM
  to JavaScript and back. A function that the module makes would stay in
  WASM. This benchmark does not measure that yet.
- `repeat` builds a string of 2,000 units by `concat`. JavaScript's
  engine uses ropes, and NaNVM copies, so this case grows with the square
  of the length.

## What the programs had to avoid

Each of these was refused when the benchmark was first written. None
gives a wrong module, since each is a refusal, but each is a limit that a
benchmark program, and a user, would meet:

- A loop whose state starts as `f64` and becomes `any`: `#1 of loop L0 is
  { i: f64, acc: f64 }, not { i: f64, acc: any }`. The programs start such
  a state from `n - n`, which is of `any`.
- A bigint literal in a loop's state, typed as a range: `a loop parameter
  of { i: int(0, 0), acc: int(0, 0) } is not in this slice`. So is `any +
  1n`: `add of any and int(1, 1) is not in this slice`. `bigSum` takes its
  `1n` as an argument.
- An index of `any`: FunctionalScript requires `a[Number(i)]`, and the
  lowering refuses `Number` of `any`. `.at(i)` is no member that L1 knows,
  so it throws. No program here can index an array in a loop.
- A value that the checker refuses after the lifetime pass, where the
  lowering inlined a `const` into a record field: `l1.subtract answers an
  owned value that nothing takes over: bind it first`. And with `a[Number(s.i)]`
  and an `f64` index: `$8 is left over`. Both are caught, but by the
  checker after the lifetime pass, where the lowering or the pass should
  refuse with a clearer reason, or handle them.
- A loop state that holds a borrowed parameter of a sealed type:
  `#1 of loop L0 is a product that holds a sealed value: not in this
  slice`. `repeat` starts from `e + e`, which it owns.

## Running it

From the repository's root, after building NaNVM's `.wasm`:

```sh
cargo build -p nanvm-l0-wasm --release --target wasm32-unknown-unknown
node doc/sasha-gil/ir/benchmark.run.mjs          # the table of times
node doc/sasha-gil/ir/benchmark.run.mjs calls    # L0 calls per program
node doc/sasha-gil/ir/benchmark.run.mjs l0       # the cost of one L0 call
node --cpu-prof doc/sasha-gil/ir/benchmark.run.mjs nanvm sumTo   # a profile of one program
```

The files are prototypes, not part of the build, and each `.mjs` starts
with `// @ts-nocheck`, as the folder's other companions do.

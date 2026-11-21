# Benchmark: IR programs on NaNVM's `.wasm`

Measured 2026-11-21, first after slice 12 ([`fjs/ir/todo/slices.md`](../../../fjs/ir/todo/slices.md))
and again after the first three levers (#4049, #4050, #4052): how fast
untyped FunctionalScript programs run when the IR lowers them to WASM and
NaNVM's `.wasm` is their runtime, beside the counting host and JavaScript
itself, and where the time goes. This is a measurement, not a decision.
The levers at the end are proposals, re-ranked from the second profile.

The code is in this folder: [benchmark.programs.mjs](./benchmark.programs.mjs)
holds the untyped programs, [benchmark.typed.mjs](./benchmark.typed.mjs) two
typed twins, and [benchmark.run.mjs](./benchmark.run.mjs) the runner. See
[Running it](#running-it).

## Summary

- **The three levers made six of the seven untyped programs on NaNVM's
  `.wasm` 4.7× to 24× faster.** Those six now run 13× to 450× slower than
  JavaScript (50× to 1,300× before), and 1.5× to 4.7× faster than the
  counting host. `repeat`, which builds a string, gained 1× to 2× and is
  still about 1,500× slower than JavaScript.
- **The typed twins still run as plain WASM about 5× to 7× faster than
  JavaScript.** Numeric untyped code is now within 13× to 70× of
  JavaScript.
- **NaNVM's handle layer is still most of a numeric loop: 90% of `sumTo`,
  `sumToAny` and `fib`.** Fewer calls reach it, but each costs as much as
  before: 9 to 35 ns. The program and the L1 bodies take 7% to 9%.
- **Two new hot spots show up now that the rest is smaller.** Each object
  lookup (`find`, `item`, `key`, `length`) copies the object's whole entry
  list, which is 40% of `readFields`. And `concat` copies both strings one
  unit at a time, which is 87% of `repeat`.

## Setup

- A cloud container: 4 cores of an Intel Xeon at 2.1 GHz, Node 26.13.1.
  NaNVM's `.wasm` is built with `--release` for `wasm32-unknown-unknown`.
  The first run is from branch `claude/project-thread-gnbpyt-12d` (#4043),
  the second from `claude/project-thread-gnbpyt-records` (#4052, on top of
  #4049 and #4050).
- Each time is the median of batches of 10 calls after a warm-up. Each
  cell below is the median of three runs. JavaScript's times vary by about
  ±30% between runs, and the WASM ones by about ±5%, except `repeat` on
  NaNVM, which varied from 4.1 to 7.8 ms in the second run.
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

After the three levers:

| Program | JavaScript | Typed IR as WASM | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 31 µs | 6.1 µs | 673 µs | 3.08 ms | 22× | 4.6× |
| `sumToAny` | 33 µs | | 2.19 ms | 10.3 ms | 67× | 4.7× |
| `fib` | 0.4 µs | 54 ns | 5.2 µs | 21.1 µs | 13× | 4.1× |
| `readFields` | 31 µs | | 14.0 ms | 32.1 ms | 450× | 2.3× |
| `callMany` | 3.0 µs | | 1.19 ms | 1.82 ms | 400× | 1.5× |
| `repeat` | 4.8 µs | | 7.42 ms | 1.52 ms | 1,550× | 0.2× |
| `bigSum` | 8.1 µs | | 1.50 ms | 3.58 ms | 185× | 2.4× |

JavaScript ran faster in the second run than in the first (31 µs against
52 µs for `sumTo`), so compare the WASM columns across runs, not the
ratios. On NaNVM, against the first run:

| Program | After slice 12 | After #4049 (borrow) | After #4050 (number paths) | After #4052 (records) | All three |
| --- | --- | --- | --- | --- | --- |
| `sumTo` | 3.64 ms | 2.70 ms | 0.70 ms | 0.67 ms | 5.4× |
| `sumToAny` | 52.7 ms | 41.8 ms | 28.3 ms | 2.19 ms | 24× |
| `fib` | 25.6 µs | 19.0 µs | 5.2 µs | 5.2 µs | 4.9× |
| `readFields` | 66.2 ms | 53.7 ms | 39.6 ms | 14.0 ms | 4.7× |
| `callMany` | 6.17 ms | 5.33 ms | 4.38 ms | 1.19 ms | 5.2× |
| `repeat` | 7.80 ms | 7.84 ms | 6.37 ms | 4.0 to 7.4 ms | 1× to 2× |
| `bigSum` | 7.06 ms | 6.10 ms | 5.54 ms | 1.50 ms | 4.7× |

One step of `sumTo` on NaNVM now takes 67 ns (364 ns before), and one
step of `sumToAny` 219 ns (5.3 µs before).

The first run's table, for the record:

| Program | JavaScript | Typed IR as WASM | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 52 µs | 6.1 µs | 3.64 ms | 9.74 ms | 69× | 2.7× |
| `sumToAny` | 63 µs | | 52.7 ms | 107 ms | 841× | 2.0× |
| `fib` | 0.5 µs | 50 ns | 25.6 µs | 57.5 µs | 51× | 2.2× |
| `readFields` | 50 µs | | 66.2 ms | 139 ms | 1,320× | 2.1× |
| `callMany` | 5.2 µs | | 6.17 ms | 10.2 ms | 1,187× | 1.6× |
| `repeat` | 5.4 µs | | 7.80 ms | 8.78 ms | 1,444× | 1.1× |
| `bigSum` | 12 µs | | 7.06 ms | 10.1 ms | 603× | 1.4× |

## Where the time goes

### L0 calls per program

From the `calls` mode. The module's literals, made once by its start
function, are left out.

| Program | L0 calls now | Per step | Before the levers | Most called now |
| --- | --- | --- | --- | --- |
| `sumTo` | 80,010 | 8 | 200,022 | `kind` 40,004, `to_f64` 20,002, `from_f64` 10,002, `drop` 10,002 |
| `sumToAny` | 240,016 | 24 | 1,560,084 | `kind` 120,008, `to_f64` 60,004, `drop` 30,002, `from_f64` 30,001 |
| `fib` | 570 | 8 | | `kind` 284, `to_f64` 142, `from_f64` 72, `drop` 72 |
| `readFields` | 560,016 | 56 | 2,000,084 | `kind` 260,008, `drop` 100,002, `to_f64` 80,004, `from_f64` 40,001, `dup` 40,001 |
| `callMany` | 29,016 | 29 | | `kind` 12,008, `to_f64` 4,004, `drop` 4,002, `from_f64` 2,001, `dup` 2,001 |
| `repeat` | 34,054 | 34 | | `kind` 16,021, `drop` 7,007, `to_f64` 4,004, `dup` 4,004, `from_f64` 2,002 |
| `bigSum` | 73,027 | 73 | 137,057 | `kind` 46,016, `drop` 15,006, `dup` 12,005 |

`kind` is now about half of every program's calls. In `sumTo`, `s.i < n` still
boxes `s.i` with `from_f64`, and `lessThan`'s fast path reads both kinds,
then `asNumber` reads each kind again before `to_f64`: 8 calls, 4 of them
`kind`, where 2 (`kind` and `to_f64` of `n`) would do. `dup` has almost
gone from the numeric loops: the records pass removed the cast after
`seal` that made most of them.

### The cost of one L0 call

From the `l0` mode: the calls are made from JavaScript, so each includes
the JavaScript-to-WASM hop, which is the first row.

| L0 call | NaNVM's `.wasm` now | Before #4049 | Counting host |
| --- | --- | --- | --- |
| `from_bool(1)`: a constant, the hop alone | 2.7 ns | 2.4 ns | 9.5 ns |
| `kind` of a number | 12.5 ns | 15.1 ns | 17.4 ns |
| `kind` of an object | 11.7 ns | 20.5 ns | 25.5 ns |
| `to_f64` | 9.2 ns | 14.9 ns | 20.7 ns |
| `from_f64`, then `drop` | 34.7 ns | 27.5 ns | 141.3 ns |
| `dup` of a string, then `drop` | 47.9 ns | 46.3 ns | 120.4 ns |

Borrowing (#4049) took the clone out of `kind` and `to_f64`. What is
left is the same for every call: `with` enters the thread-local state,
sets and clears the busy flag, and checks the slot's generation. A number
still takes a slot, so `from_f64` allocates one and `drop` frees it.

### Profile

From `node --cpu-prof` on the `nanvm` mode, self time grouped by symbol
name. Compile time, the harness and the garbage collector are left out.

| Program | NaNVM's handle layer | NaNVM objects and strings | NaNVM's allocator | NaNVM, other | The program and L1 bodies | The JavaScript host |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 91% | | | | 9% | |
| `sumToAny` | 92% | | | | 8% | |
| `fib` | 90% | | | | 9% | 1% |
| `readFields` | 53% | 30% | 10% | 3% | 4% | |
| `callMany` | 65% | 5% | 1% | 3% | 2% | 24% |
| `repeat` | 12% | 80% | 7% | | 1% | |
| `bigSum` | 77% | 4% | 4% | 8% | 7% | |

The first profile, before the levers, had the handle layer at 94% of
`sumTo` and 58% to 64% of the others, and objects and strings at 21% to
25%.

- **The handle layer** is `with`, the slab, the thin `kind`, `to_f64`,
  `from_f64`, `dup` and `drop` wrappers, and the drop of an unpacked
  value.
- **Objects** in `readFields`: `find`, `item`, `key` and `length` each
  call `Object::own_entries`, which builds a new `Vec` of every entry, with
  a clone of each key and value, for one lookup (`l0/mod.rs`, `find` and
  `property`). `own_entries` alone is 9% of the time, and the `malloc` and
  `free` behind it most of the allocator's 10%.
- **Strings** in `repeat`: `concat` collects
  `a.index_iter().chain(b.index_iter())` into a new string, one unit at a
  time, then copies it again into an `Rc` slice. That is 87% of the time
  with the allocator, and it grows with the square of the length. The
  counting host joins JavaScript strings, so it is now 5× faster here.
- **The JavaScript host** in `callMany`: each call of the JavaScript
  function `f` reads its two arguments into JavaScript values (`read` in
  the NaNVM host) and makes its result back. A function that the module
  makes would not cross.

## Levers

### Done

1. **Borrow in the read-only L0 calls** (#4049): `kind` of a number from
   15 to about 12 ns and `to_f64` from 15 to 9 ns, 1.0× to 1.35× on the
   programs.
2. **Fast paths for numbers in L1** (#4050): `s.i < n` from 20 L0 calls
   to 8, 3.9× on `sumTo` and 3.7× on `fib`.
3. **Records of `any` stay records** (#4052, the records pass): no object
   built or read for a loop's state, 13× on `sumToAny`, 2.8× on
   `readFields`, 3.7× on `callMany` and 3.7× on `bigSum`.

### Next, by gain for cost

1. **Test only the side that is not known** (the lowering and L1, small).
   Where one operand is already `f64`, as `s.i` in `sumTo`, the lowering
   would call a variant of the operator that takes it unboxed, and the
   fast path would not read a kind twice. `s.i < n` would go from 8 L0
   calls to 2, so `sumTo` and `fib` would be about 2× to 3× faster, and
   every loop counter with them. This is an estimate.
2. **Object lookups without a copy** (NaNVM, small). `find`, `item`, `key`
   and `length` would read the object's entries in place, in the order
   that `own_entries` gives, with no `Vec`. That removes most of the 40%
   of `readFields` in objects and the allocator, about 1.5× to 2×. It stays
   inside `l0/mod.rs`.
3. **NaN-boxed handles** (NaNVM's ABI, large). The handle would be the NaN
   box's bits, as [type-system.md](./type-system.md) and
   [nan-box-in-ir.md](./nan-box-in-ir.md) lay them out, so a number or a
   constant needs no slot, and `kind`, `to_f64` and `from_f64` become a
   few instructions that the module can inline. The handle layer is still
   53% to 92% of every program but `repeat`, so this is still the largest
   gain: up to about 10× on numeric loops. It is the largest change too:
   NaNVM's ABI, its misuse checks and the inline fragments of
   [`../wasm/inline-fragments.md`](../wasm/inline-fragments.md). Levers 1
   and 2 do not depend on it, and lever 1 shrinks what it has to inline.
4. **A `concat` that copies in bulk** (NaNVM, small to medium). Copying
   both strings' units with one slice copy each, straight into the new
   string, would make `repeat` several times faster but still quadratic.
   A rope, as JavaScript's engines use, would make it linear, and is a
   larger change to NaNVM's strings.
5. **Cancel `dup`/`drop` pairs in the lifetime pass** (medium). After the
   records pass, `dup` is at most 1 in 6 of the calls (12,005 of 73,027 in
   `bigSum`, 40,001 of 560,016 in `readFields`), so this lever gains less
   than it would have before: a few percent, not the 20% that the first
   profile suggested.

One limit stays as it was: a loop whose state starts as `f64` and becomes
`any` is still refused (below). The records pass runs after the lowering,
so it does not lift that refusal.

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

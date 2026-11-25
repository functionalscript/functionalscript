# Benchmark: IR programs on NaNVM's `.wasm`

Measured 2026-11-21, first after slice 12 ([`fjs/ir/todo/slices.md`](../../../fjs/ir/todo/slices.md))
and again after the first three levers (#4049, #4050, #4052), then on
2026-11-22 on `main` after the next three (#4055 to #4057,
[third run](#after-the-next-three-levers)), and on 2026-11-24 after
[linkAny (checkpoint 4e)](#after-linkany-checkpoint-4e): how fast
untyped FunctionalScript programs run when the IR lowers them to WASM and
NaNVM's `.wasm` is their runtime, beside the counting host and JavaScript
itself, and where the time goes. This is a measurement, not a decision.
The levers at the end are proposals, re-ranked from the second profile;
numeric-loop import costs after linkAny supersede the earlier headline.

The code is in this folder: [benchmark.programs.mjs](./benchmark.programs.mjs)
holds the untyped programs, [benchmark.typed.mjs](./benchmark.typed.mjs) two
typed twins, and [benchmark.run.mjs](./benchmark.run.mjs) the runner. See
[Running it](#running-it).

## Summary

The first four points are from the second run (before linkAny); the
[third run](#after-the-next-three-levers) changes them as it says. They
are historical for numeric loops once Any is linked — see
[After linkAny](#after-linkany-checkpoint-4e) and the fifth point.

- **The three levers made six of the seven untyped programs on NaNVM's
  `.wasm` 4.7× to 24× faster.** Those six then ran 13× to 450× slower than
  JavaScript (50× to 1,300× before), and 1.5× to 4.7× faster than the
  counting host. `repeat`, which builds a string, gained 1× to 2× and was
  still about 1,500× slower than JavaScript.
- **The typed twins still run as plain WASM about 5× to 7× faster than
  JavaScript.** Before linkAny, numeric untyped code was within 13× to
  70× of JavaScript.
- **Before linkAny, NaNVM's handle layer was most of a numeric loop: 90%
  of `sumTo`, `sumToAny` and `fib`.** Fewer calls reached it, but each
  cost as much as before: 9 to 35 ns. The program and the L1 bodies took
  7% to 9%.
- **Two second-run hot spots showed up once the rest was smaller** (since
  fixed in the [third run](#after-the-next-three-levers)): each object
  lookup (`find`, `item`, `key`, `length`) copied the object's whole entry
  list (#4056 now reads in place), and `concat` copied both strings one
  unit at a time (#4057 now copies in bulk).
- **After linkAny (checkpoint 4e), numeric loops on NaNVM are about 1× to
  6× JavaScript, with no L0 imports during the program.** `sumTo` and
  `fib` match JavaScript on this container; `sumToAny` is about 6× (was
  36×). Reference- and string-heavy programs still pay `Ref` and container
  imports, not the retired whole-entry-list / unit-at-a-time copies.
- **After short strings S4 (variant B emit + linked `length`),** the
  short-only microbench `shortOps` is about **1.5×** faster than emit A
  on NaNVM and about half the L0 import traffic; `repeat` is about
  **1.3×** faster. Both remain hundreds of times JavaScript — record
  `find`/`item` and `Ref` still dominate. See
  [After short strings (S4)](#after-short-strings-s4).

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
| `shortOps(s, n)` | `acc + s.length + (s + s).length`, short-only (v1 tags; `s = 'a'`), n = 10,000 |
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

### After the next three levers

On `main` at `192dbe7`, 2026-11-22, after #4055 (number paths), #4056
(object reads in place) and #4057 (bulk `concat`), the median of three
runs. This container ran JavaScript about 2× slower than the one of the
second run (56 to 67 µs for `sumTo`), so compare the ratios, and the
WASM columns only roughly.

| Program | JavaScript | Typed IR as WASM | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 63 µs | 6.1 µs | 310 µs | 434 µs | 5× | 1.4× |
| `sumToAny` | 62 µs | | 2.07 ms | 6.71 ms | 36× | 3.2× |
| `fib` | 0.72 µs | 54 ns | 2.3 µs | 3.5 µs | 3× | 1.5× |
| `readFields` | 60 µs | | 10.3 ms | 35.4 ms | 171× | 3.4× |
| `callMany` | 5.1 µs | | 1.29 ms | 1.31 ms | 258× | 1.0× |
| `repeat` | 8.5 µs | | 0.94 ms | 1.29 ms | 108× | 1.4× |
| `bigSum` | 19 µs | | 2.50 ms | 3.96 ms | 127× | 1.6× |

L0 calls per program, from the `calls` mode:

| Program | L0 calls | Most called |
| --- | --- | --- |
| `sumTo` | 20,004 | `kind` 10,001, `to_f64` 10,001 |
| `sumToAny` | 140,012 | `kind` 50,004, `to_f64` 50,004, `drop` 20,002, `from_f64` 20,001 |
| `fib` | 144 | `kind` 71, `to_f64` 71 |
| `readFields` | 440,012 | `kind` 170,004, `drop` 90,002, `to_f64` 70,004, `dup` 40,001, `from_f64` 30,001 |
| `callMany` | 21,012 | `kind` 7,004, `to_f64` 3,004, `drop` 3,002, `dup` 2,001, `push` 2,000 |
| `repeat` | 26,051 | `kind` 11,018, `drop` 6,007, `dup` 4,004, `to_f64` 3,004, `from_f64` 1,002 |
| `bigSum` | 77,029 | `kind` 50,018, `drop` 15,006, `dup` 12,005 |

Against the second run: the numeric loops are now 3× to 36× slower than
JavaScript (13× to 67×), `repeat` about 100× (1,550×), and `readFields`
about 170× (450×). `kind` is still a third to two thirds of every
program's calls.

### After linkAny (checkpoint 4e)

On branch `cursor/ir-runtime-4e-remeasure-8be5` at `79ba661aaf`, 2026-11-24
(America/Los_Angeles), after #4113–#4115 (Any in the IR, counting host
boxes, `linkAny`). Median of three runs on this container. Scalar ops are
local WASM; import calls that remain are `Ref.*` and container/string work.

| Program | JavaScript | Typed IR as WASM | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 25 µs | 5.0 µs | 22.6 µs | 25.7 µs | 1× | 1.1× |
| `sumToAny` | 25 µs | | 152 µs | 161 µs | 6× | 1.1× |
| `fib` | 0.30 µs | 46 ns | 225 ns | 588 ns | 1× | 2.6× |
| `readFields` | 25 µs | | 10.2 ms | 38.9 ms | 410× | 3.8× |
| `callMany` | 2.5 µs | | 1.31 ms | 2.93 ms | 520× | 2.2× |
| `repeat` | 3.8 µs | | 3.61 ms | 10.2 ms | 950× | 2.8× |
| `bigSum` | 7.7 µs | | 3.60 ms | 7.89 ms | 470× | 2.2× |

L0 **import** calls per program (local Any ops are not imports). The
runner's post-call `drop` of the result is caller cleanup and is not
counted:

| Program | L0 calls | Most called |
| --- | --- | --- |
| `sumTo` | 0 | — |
| `sumToAny` | 0 | — |
| `fib` | 0 | — |
| `readFields` | 220,000 | `kind_ref` 100,000, `dup_ref` 40,000, `drop_ref` 40,000, `find` 20,000, `item` 20,000 |
| `callMany` | 14,000 | `kind_ref` 4,000, `drop_ref` 3,000, `push` 2,000, `dup_ref` 2,000, `begin_array` 1,000 |
| `repeat` | 61,053 | `kind_ref` 24,021, `dup_ref` 13,011, `drop_ref` 13,011, `find` 3,002, `item` 3,002 |
| `bigSum` | 77,028 | `kind_ref` 50,018, `drop_ref` 15,005, `dup_ref` 12,005 |

Numeric loops drop from tens of thousands of `kind`/`to_f64`/`from_f64`
imports to none during the program. `sumTo` and `fib` on NaNVM are about
as fast as JavaScript on this container; `sumToAny` is about 6× (was
36×). Programs that touch references still pay `Ref` and container
imports; `repeat` is slower than the prior table on this machine (string
work dominates, and JS was also faster here).

### After short strings (S4)

On branch `cursor/short-strings-s4-d9cd` (stacked on S3 #4123 / S2 #4122),
2026-11-25 (America/Los_Angeles), after host short-box emit (S2) and
`linkString` for `length`/`unit` (S3). Median of three runs on this
container (4-core Intel Xeon, Node 26.13.1). **Variant measured: B** —
emit `shortWhenEnabled` with v1 tags `empty` / `s1x16` / `s2x16` (max
length 2); linked IR `string.length` / `string.unit`; long miss still
imports. Emit A (`alwaysDynRef`) is the control. C was not measured
(multi-local `str` still deferred).

Primary: `shortOps('a', 10_000)` — each step concats `s + s` (still
short) and adds both lengths. Secondary: `repeat` as long-path /
regression.

| Program | Emit | JavaScript | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | L0 calls |
| --- | --- | --- | --- | --- | --- | --- |
| `shortOps` | A | 29.1 µs | 38.98 ms | 149.15 ms | 1,340× | 660,032 |
| `shortOps` | B | 29.0 µs | 26.19 ms | 101.15 ms | 903× | 310,025 |
| `repeat` | A | 4.3 µs | 4.03 ms | 13.41 ms | 937× | 61,053 |
| `repeat` | B | 4.3 µs | 3.12 ms | 9.71 ms | 726× | 34,002 |

L0 **import** calls (local `string.length` / `string.unit` are not
imports). Most called under B for `shortOps`: `kind_ref` 120,009,
`dup_ref` 40,004, `drop_ref` 40,004, `find` 30,002, `item` 30,002 —
record traffic on the loop state, not string length imports.

Full suite under emit B (median of three; numeric loops unchanged vs
linkAny):

| Program | JavaScript | Typed IR as WASM | IR on NaNVM's `.wasm` | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |
| --- | --- | --- | --- | --- | --- | --- |
| `sumTo` | 25.5 µs | 5.0 µs | 22.6 µs | 27.9 µs | 1× | 1.2× |
| `sumToAny` | 25.6 µs | | 145.7 µs | 149.7 µs | 6× | 1.0× |
| `fib` | 0.32 µs | 46 ns | 221 ns | 589 ns | 1× | 2.7× |
| `readFields` | 25.7 µs | | 6.83 ms | 32.40 ms | 266× | 4.7× |
| `callMany` | 2.6 µs | | 1.46 ms | 3.68 ms | 562× | 2.5× |
| `shortOps` | 29.0 µs | | 26.19 ms | 101.15 ms | 903× | 3.9× |
| `repeat` | 4.3 µs | | 3.12 ms | 9.71 ms | 726× | 3.1× |
| `bigSum` | 8.0 µs | | 3.91 ms | 10.85 ms | 489× | 2.8× |

**Decision gate (closed):** NaNVM-targeted hosts default to **B**
(`emitB` — `shortWhenEnabled` + v1 tags `empty`/`s1x16`/`s2x16`; linked
`length`/`unit`). Counting host defaults to **A** (`emitA` /
`alwaysDynRef`) as the control; pass `emitB` explicitly for short emit
there. A and C stay buildable behind the same String interface. `shortOps`
is still ~900× JavaScript — the next win is not more string packing but
cutting record `find`/`item` / `Ref` on the loop state (or a flatter
short-only loop). C vs B comparison waits on multi-local `str` (S5+).

## Where the time goes (historical: before linkAny)

The tables and profile below are from the second run above (after
borrow / number paths / records, before the three levers of the
[third run](#after-the-next-three-levers)), when Any was still an L0
import and every scalar op was a host call. After
[linkAny (checkpoint 4e)](#after-linkany-checkpoint-4e), numeric loops
make no L0 imports during the program; see that section for current
tallies and times. The diagnosis here still explains why the earlier
levers mattered and where reference-heavy programs pay.

### L0 calls per program

From the `calls` mode of the second run. The module's literals, made once
by its start function, are left out.

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
4. **Test only the side that is not known** (#4055, the lowering): an
   operator of `any` matches each `any` once against `number`, reads it
   once, and uses the IR's operator, leaving a float unboxed; only
   otherwise does it call L1. The records pass also stopped copying a
   read of a split local into a `let` of its own. On NaNVM, medians of
   three runs:

   | Program | Before | After | Speed-up | L0 calls before | after |
   | --- | --- | --- | --- | --- | --- |
   | `sumTo` | 673 µs | 141 µs | 4.8× | 80,010 | 20,004 |
   | `fib` | 5.2 µs | 1.2 µs | 4.3× | 570 | 144 |
   | `sumToAny` | 2.19 ms | 1.16 ms | 1.9× | 240,016 | 140,012 |
   | `readFields` | 14.0 ms | 12.9 ms | 1.1× | 560,016 | 440,012 |
   | `callMany` | 1.19 ms | 1.12 ms | 1.1× | 29,016 | 21,012 |
   | `bigSum` | 1.50 ms | 1.68 ms | 0.9× | 73,027 | 77,029 |

   `sumTo` now runs about 3× to 4× slower than JavaScript, and `fib`
   about 2× to 3×. `bigSum` pays one `kind` more for each operand, which
   is a bigint and so goes on to L1, which reads it again.

### Done after the re-profile

5. **Object lookups without a copy** (#4056): `find`, `item`, `key` and
   `length` read the object's entries in place. With #4055, `readFields`
   went from 450× to about 170× JavaScript's time.
6. **A `concat` that copies in bulk** (#4057): each string's units in
   one copy, straight into the new string. `repeat` went from 1,550× to
   about 100× JavaScript's time, 7.4 to 0.94 ms, and is still quadratic.

### Done in checkpoint 4e

7. **NaN-boxed handles via a runtime in the IR** (#4113–#4116): Any is
   written over the box and linked into programs (`any.*`); the counting
   host speaks boxes; numeric loops drop from tens of thousands of
   import calls to none during the program. See
   [After linkAny](#after-linkany-checkpoint-4e).

### Done in short strings S2–S4

8. **Short-string boxes + linked length/unit** (#4121–#4123, S4
   remeasure): host emit of shorts when a v1 tag fits (B); `linkString`
   for `length`/`unit`; short-only microbench about 1.5× vs emit A. See
   [After short strings (S4)](#after-short-strings-s4).

### Left

1. **Cancel `dup`/`drop` pairs in the lifetime pass** (medium): a few
   percent on reference-heavy programs that still call `Ref.dup_ref` /
   `drop_ref` (and on any leftover `dup`/`drop` pairs).
2. **A rope for `concat`** (NaNVM, larger): would make `repeat` linear.
3. **Short-string variant C / flatter short loops** (S5+): multi-local
   `str`, or a shortOps shape that does not rebuild a record each step.

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
  so it throws. No program here can index an array in a loop. `Number(x)`
  (#4061) and `.at` (#4063) are open pull requests.
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
node doc/sasha-gil/ir/benchmark.run.mjs          # the table of times (emit A)
node doc/sasha-gil/ir/benchmark.run.mjs table B  # times with short emit (variant B)
node doc/sasha-gil/ir/benchmark.run.mjs calls B  # L0 calls with short emit
node doc/sasha-gil/ir/benchmark.run.mjs l0       # the cost of one L0 call
node --cpu-prof doc/sasha-gil/ir/benchmark.run.mjs nanvm shortOps B   # a profile of one program
```

The files are prototypes, not part of the build, and each `.mjs` starts
with `// @ts-nocheck`, as the folder's other companions do.

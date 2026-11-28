# H3c: the crossing, and the steps after it

**Status:** plan, not started. This note is also the handoff of the IR heap
work, so that another assistant can pick it up: where things stand, what
H3c does in detail, how to check it, and what comes after (H3d, H3e, H4).
The design it follows is [long-strings.md](./long-strings.md) (the owner
chose A on its six choices, 2026-11-27) and [heap.md](./heap.md); the task
list is [fjs/ir/todo/heap.md](../../../fjs/ir/todo/heap.md).

## Where things stand (2026-11-28)

The steps are stacked PRs, each on the branch of the one before, so each
PR's diff is its own step.

| Step | PR | Branch | State |
| --- | --- | --- | --- |
| H1 `Memory` | #4148 | `claude/project-thread-4t5hyr-h1` | merged |
| H2a `misuse` | #4149 | `…-h2` | merged |
| H2b flow refinement | #4150 | `…-h2b` | merged |
| H2c release arena | #4151 | `…-h2c` | merged |
| H2d debug arena | #4155 | `…-h2d` | merged |
| H3 note | #4156 | `…-h3doc` | merged |
| H3a IR references in Any | #4159 | `…-h3a` | merged |
| H3b long strings in the IR | #4163 | `…-h3b` | approved, every review thread resolved |
| H3c the crossing | this note | `…-h3c` | the plan below |

What H3a and H3b built, which H3c uses:

- **The box of an IR string** is `0x7FF9_0000_0000_0002 | p`: kind nibble 9
  and the block's 8-aligned address `p` (long-strings.md, choice 3).
  `fjs/ir/runtime/box/module.f.js` has `IR_STRING`, `REF_TAG` and `KIND`.
  Its `isIrStringTerm` tests only the kind nibble, so it holds only of a
  value already known to be a reference (`isRefTerm`): a number or a short
  string can have nibble 9 too.
- **Any's hooks** (`withHeap` and, for debug, `checkedWithHeap` in
  `fjs/ir/runtime/any/module.f.js`) send an IR reference to the Heap's
  `dup`, `drop` and `free`, and every other reference to `Ref` as before.
- **String's heap path** (`fjs/ir/runtime/string/heap.f.js`, `withHeap`)
  answers `length`, `unit`, `concat` and `substring` on the three forms of
  a string: short box, IR block, NaNVM's. Its mixed `concat` already copies
  an IR string into NaNVM through L0's `Units.make_string(p, n)`, the
  import at the low level that H3c uses too.
- **NaNVM's `make_string`** reads any bytes of the memory but those at
  address 0, and no more than `isize::MAX` (`nanvm/l0-wasm/src/lib.rs`,
  `readable`): at most `0x3FFF_FFFF` units on wasm32. A block of
  `heap.f.js` holds up to `0x7FFF_FFFA` units (`most`), so a longer IR
  string could not cross; see H3c's first task.
- **The counting host's `make_string`** builds every unit into one array
  and spreads it into `String.fromCharCode` (`fjs/ir/l0/host/count/module.mjs`,
  `units`). An engine caps how many arguments a call takes, so a string of
  a few hundred thousand units already traps with `RangeError` there, well
  below NaNVM's limit; see H3c's first task. The NaNVM host's own JS
  reader of units already copies in chunks of `0x1000`
  (`fjs/ir/l0/host/nanvm/module.mjs`).
- **Both hosts refuse an IR box.** NaNVM and the counting host check a
  box's kind against the value they keep, so a box of nibble 9 traps with
  `not a value` (`nanvm/lib/src/l0/abi.rs`). That is what makes the proof
  of H3c cheap: if any IR string reaches the host, a program proof traps.
- **Nothing links the heap yet.** The pipeline in
  `fjs/ir/from_fast/module.f.js` (end of the program lowering) is
  `link(l1)` → `records` → `literals` → `linkAny` → `linkString` →
  `inlineHinted`, and `linkString` takes the short-only String. H3d
  switches it.

## H3c: the crossing

**Goal:** no IR string ever reaches NaNVM. Wherever a value crosses into
NaNVM, a long IR string becomes a NaNVM string, and the IR drops its
reference where the crossing took ownership.

### First: every IR string must fit a crossing

Two ceilings stand between "every IR string crosses" and today's code, and
H3c lowers both to the same place: NaNVM's `make_string` limit of
`0x3FFF_FFFF` units.

1. **`heap.f.js`'s `most`.** NaNVM's `make_string` copies at most
   `0x3FFF_FFFF` units (2 bytes each, within wasm32's `isize::MAX`), and
   `heap.f.js`'s `most` lets a block hold up to `0x7FFF_FFFA`, so an IR
   string past the first would trap `too long` at its crossing instead of
   crossing. Lower `most` to `0x3FFF_FFFF`, so that a `concat` past it is
   out of memory where the string is made, as any other request past the
   arena's limit is. Another conversion path (copying in pieces into a
   NaNVM builder) would cost Rust for a size no program here reaches. A
   proof in `heap.proof.mjs` checks the new limit on both arenas.
2. **The counting host's spread.** Its `make_string` builds one array of
   every unit and calls `String.fromCharCode(...units)`, and V8 rejects a
   call past a few hundred thousand arguments with `RangeError`. Lowering
   `most` only to NaNVM's limit would leave every planned proof that runs
   on both hosts still trapped on the counting host for a string well
   below that. H3c therefore rewrites the counting host's `units` to copy
   in chunks, as the NaNVM host's JS reader already does (`0x1000` units
   per `fromCharCode`), so both hosts take every IR string that fits
   `most`. A common lower `most` that stays under the spread limit is
   rejected: it would shrink every arena for an engine quirk the counting
   host can fix in one function. A proof of `make_string` on the counting
   host takes a length past the spread (for example `0x3_0000` units) and
   answers the string.

### Where the wrap goes (decided: A, `linkCrossing`)

The owner chose **A** (2026-11-28): a new `linkCrossing` in
`fjs/ir/from_fast/link/module.f.js`, after `linkString`, as `linkAny` and
`linkString` are. It rewrites each call of an import listed below into a
call of a wrapper that it adds to the program, `cross.push`, `cross.find`
and so on. It covers hand-written IR too, and the lowering stays unaware
of the heap. **B** (wrap in the lowering from FAST) is rejected: it
misses hand-written IR.

### What crosses: every place a value goes into NaNVM

The L0 and L1-native signatures, from `fjs/ir/l0/module.f.js` and
`fjs/ir/native/module.f.js`, whose parameter can hold a string. A
parameter typed so that it cannot hold one (an `array`, an `object`, a
`function`, a `bigint`, a builder, an integer) is not wrapped.

**Owned arguments**: the import takes the value. The wrapper copies a long
IR string into a NaNVM string, drops the IR reference through Any's `drop`
(which reaches the Heap), and passes the NaNVM string on, owned.

| Import | Parameter |
| --- | --- |
| `Containers.push(b, v)` | `v`, any |
| `Containers.push_property(b, k, v)` | `k`, string; `v`, any |
| `Functions.throw(v)` | `v`, any |
| `Functions.make_function(c, frame, length, text)` | `text`, string or undefined |

**Borrowed arguments**: the import only reads the value. The wrapper makes
a NaNVM copy, calls, then drops the copy (through `Ref`), and leaves the IR
string to its owner.

| Import | Parameter |
| --- | --- |
| `Containers.find(o, k)` | `k`, string |
| `Containers.join(parts, separator)` | `separator`, string |
| L1 native `stringToNumber(s)` | `s`, string |
| L1 native `stringToBigInt(s)` | `s`, string |
| L1 native `bigintLess(a, b)` | `a`, `b`, any |

**String's own imports** (`String.length`, `unit`, `concat`, `substring`)
are no crossing once H3d links `heap.f.js`, since its bodies answer for an
IR string themselves and call L0 only with NaNVM's. Before H3d they are
the short-only path's long miss; H3c can leave them, since no IR string
exists before H3d links the heap. (H3d must then redirect `concat` and
`substring` too: `linkString` today redirects only `length` and `unit`,
`stringShortOps`.)

**Results that NaNVM reads**, wrapped only where the result's type can
hold a string, as for parameters: `any`, or an `any` whose kinds include
`string`. A result of `f64`, of a boolean or of an integer is no box, and
one of `only(any, 'array')` or another kind without `string` holds no IR
string (an array's items crossed when `push` took them), so they keep
their type and ABI unwrapped; the program proofs' exports have all of
these (`literals.units`, `throws.bigints`, `arrays.none` in
`fjs/ir/from_fast/testlib.f.js`):

- **A function with a code index**, which NaNVM calls through `call`: the
  code that `make_function` takes (a `['code', name]` term). The link step
  wraps the code's function so that a long IR string it answers is copied
  and the IR reference dropped, and points the `code` term at the wrapper.
- **Each exported function** whose result can hold a string, which the
  host calls by name and reads through NaNVM: the same wrap of its result. Today's `init` answers
  nothing (`fjs/ir/README.md`, `init`); L0 §20's `init`, once built, is one
  more such result.

What comes back from NaNVM (`item`, `key`, `join`, `text`, `frame`,
`call`'s result, the natives' strings) is NaNVM's and stays so (choice 2):
no wrap.

### The wrapper's cost

Each wrapper tests its argument for a reference of kind 9 in one mask and
compare, `eq(and(b, n(REF_TAG | KIND)), n(IR_STRING))`, which holds the
reference tag and the nibble together; `isIrStringTerm` alone is not
enough, since an `any` that is a number or a short string can have nibble 9
too, and the wrapper would take it for a block. It is hinted to inline
(`hint('always', …)`, see the note on #4162 below), so a value that is no
IR string costs that test and nothing else. A follow-up could skip the test where the types prove that no IR
string can be there; not in H3c.

### Proofs

- **Every program proof shows that none crosses**, since both hosts trap on
  an IR box: the program proofs in `fjs/ir/from_fast/program.proof.f.js`,
  `fjs/ir/wasm/proof.mjs` and their rerun on NaNVM's .wasm in
  `fjs/ir/l0/host/nanvm/nanvm.test.mjs`. Before H3d no program makes an IR
  string, so H3c needs proofs of its own that do:
- **One proof per wrap kind**: an owned argument, a borrowed argument, a
  code index's result, an export's result, each with a long IR string
  (more than 2 units, so no short box holds it), run on the counting host
  and on NaNVM, with the debug arena, so that `live()` is back where
  `init` left it (a missed drop shows as a leak, a double drop traps).
- **Values of nibble 9 that are no IR string** pass through every wrapper
  unchanged: a finite number whose bits have nibble 9, short strings whose
  tag puts 9 there, and NaNVM's own references. The long-IR-string cases
  alone would not catch a wrapper that tests the nibble only.
- **The link step's own proofs**, in `link/proof.f.js`: which calls it
  rewrites, that a parameter or a result that cannot hold a string is left
  alone, that
  it refuses a program whose own name collides with a wrapper's, as
  `linkAny` does.
- 100% coverage for every changed `module.f.js` (AGENTS.md).

## H3d: link and measure

- `linkHeap`: the Heap module, Any's `withHeap` in place of today's Any,
  `heap.f.js`'s String in place of the short-only one, and H3c's
  `linkCrossing`; the release arena by default and `counted` under one
  `debug` flag (choice 6), which the runtime options in
  `fjs/ir/from_fast/module.f.js` carry, as `checkedKind` does today.
- Every program proof on both hosts and both arenas.
- **Measure** against today's long path: `repeat` and `shortOps`
  (`doc/sasha-gil/ir/benchmark.md`), and a new benchmark of arrays of long
  strings (built by `concat`, then `join`ed), which prices choice 1's
  copies.
- If the heap loses, a card to the owner: keep it off by default, or the
  note's fallback C for containers (long-strings.md, choice 1).
- Maybe: `read_units` on the counting host (long-strings.md, open
  questions), so that a mixed `concat` stays in the IR; only if the
  numbers show that path matters.

## H3e: the notes

benchmark.md's new rows, and what H3d's numbers change in long-strings.md,
heap.md and `fjs/ir/todo/heap.md`.

## H4: a note first

H4 holds five parts (todo/heap.md): paged size classes behind the same
interface; a `recover` that recounts from the roots; the record at each
region's start that leads a walk of every block; the root table for the
references of constants and of the host; and the tag that a debug build
copies from a block's header into bits 32 to 47 of its box. That needs a
note of its own with choices for the owner, as H3 had, before any code.
New branch names need the owner's OK (proposed: `…-h4doc`, `…-h4a` and up).

## Working on the stack

- **Branches:** `claude/project-thread-4t5hyr-h3c`, `-h3d`, `-h3e` are
  approved, each on the one before, with a PR once checks pass, its base
  the branch below. Push to no other branch without the owner's OK.
- **GitHub rebases the lowest open branch** onto main when the PR below it
  merges (committer "GitHub"), so the branches above share no recent base
  with it. Merge it up rather than rebasing: never rewrite a pushed
  branch's history.
- **#4162** (another thread) changes `hint('always', f)` to
  `hint({ inline: 'always' }, f)`. Whichever of it and this stack merges
  second rewrites the other's calls (`block_length` in
  `runtime/string/heap.f.js`, the `aliased` proof in `inline/proof.f.js`,
  and any H3c wrapper).
- **A small nit rides on this branch:** the comment of #4150's `aliased`
  proof in `fjs/ir/inline/proof.f.js` now says only what the proof shows
  (commit "ir: say only what the aliased proof shows").
- **PR rules:** titles of at most 64 characters and the title and
  description rules in CONTRIBUTING.md's "Opening a pull request" section
  (the repository has no PR template); Codex and a human reviewer comment
  on each PR, and each thread gets a reply with the fixing commit, then is
  resolved.

## Checks before each push

Run them inside the repository's shell, `./dev.sh` (mise, which pins the
tools in `mise.toml`: Node 26.13.1, TypeScript 7.0.2, Rust 1.100.0), as
AGENTS.md says; `npx tsc` outside it fetches whatever the registry calls
latest. Where mise cannot run (it is blocked in the claude.ai cloud), the
same pins installed by hand stand in: Node 26.13.1's tarball from
nodejs.org and `npm install typescript@7.0.2` in a folder of its own, its
`tsc` run from the root; Node 22 fails the coverage of throw tests. If
neither works, a check is unavailable, and the PR is not ready.

```sh
tsc                                                      # 7.0.2, from the root
(cd fjs/ir && npm start test)
(cd fjs/ir && npm start cov node)                        # 100% for changed module.f.js
(cd fjs/ir && node --test ../emergent_testing/js-only.mjs)
node --test ./fjs/ir/l0/host/nanvm/nanvm.test.mjs        # needs NaNVM's .wasm
npm start compile                                        # the FJS compiler, ~4 min
node --test fjs/emergent_testing/js-only.mjs
```

NaNVM's .wasm: `cargo +1.100.0 build -q -p nanvm-l0-wasm --release --target
wasm32-unknown-unknown` (1.97 fails const-eval). Traps met so far: the FJS
compiler refuses a const used before its definition, even inside a
function body; a computed index must be `a[Number(k)]`; no regex and no
`try`/`catch` in `.f.js`; no checks that match text; a literal const is
pinned with `/** @type {const} */ (…)`; shared types go in `types.ts`.

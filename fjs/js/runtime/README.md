# The runtime

The built-in member functions, defined once. [`module.f.js`](./module.f.js)
exports `runtime`: for each of the seven receiver types, an object keyed by
every name a module may call on it, each entry a **body** — a
FunctionalScript function of the receiver and then the arguments as the
call passed them, `undefined` past the end — or the marker **`'native'`**,
a name every VM binds itself. The proposal and the steps still to take are
[`../todo/runtime.md`](../todo/runtime.md).

## The keys are the admitted set

A type has exactly the member functions its object holds.
[`types.ts`](./types.ts) pins each type's keys to the names `allowedCalls`
admits on that type's prototype ([`../prototype`](../prototype/module.f.js)),
so the parser's list and this table name the same functions, and
[`proof.f.mjs`](./proof.f.mjs) checks the same at run time. A name is added
to its prototype's row there and keyed here, in the same change; `tsc`
refuses either alone. `prohibitedCalls` stays the parser's: a VM never sees
a prohibited name, since no EDAG carries one.

## The marker

A `'native'` entry is one of two things, and the comment beside it says
which:

- a **primitive**, which no body can define in terms of the rest — for a
  string, the code-unit read `charCodeAt` and the substring `slice`;
- a name whose body **waits on a primitive the language has not admitted**
  — `toLowerCase` and `toUpperCase` on a string from a code unit,
  `String.fromCharCode`, over which the Unicode case tables are written;
  the number formatters and a nondecimal `toString` radix on `BigInt`, over
  which the exact decimal expansion of a double is written. Both arrive
  with the static-function step.

Every other name is marked only until its body is written; the rest of the
string and array names are the next batches.

## How each VM binds it

A VM answers a call on a receiver it does not own in this order: the
receiver's own property, then its **native** implementation of the name,
then the **runtime's body**, then the `TypeError` for calling `undefined`.
A native implementation may stand beside a body where the VM measures the
gain; the body is the reference, and the corpus in
[`../../nanvm/member`](../../nanvm/member/module.f.js) checks the native
answer against it.

- **The represented interpreter** —
  [`edag/value/method`](../../edag/value/method/module.f.mjs) — implements
  most names natively through the host's own built-ins, and the rest from
  the runtime its executor is given: the evaluated `runtime` export, in the
  `runtime` field of an `amnesia` or `memo` context
  ([`edag/operations/types.ts`](../../edag/operations/types.ts)), which
  reaches every function the invocation calls. The transpiler takes it as
  `interpretWith(runtime)`, and `fjs/nanvm/harness` loads it from this
  module's source for the fixture expectations it writes. An executor given
  no runtime answers a body's name with the `TypeError` of a VM that binds
  nothing, never with a host built-in.
- **NaNVM** — `npm run gen` compiles this module to
  `nanvm/lib/src/vm/gen.runtime.rs` through the Rust backend, the compiler
  being the generator, and `nanvm-lib`'s `IVm::runtime_method` is the hook
  a VM binds it through: `naive` answers it by reading the compiled
  object's entry for the receiver's type and the key, and a VM without
  static functions, which cannot run a body, binds nothing. The native
  tables in `vm/lambda` keep every marked name.

The generator also writes the module's EDAG as
`gen.edag.data.mjs` beside it, for the one consumer that needs the runtime
as data without the compiler: the corpus proof
[`../../nanvm/proof.f.mjs`](../../nanvm/proof.f.mjs), which runs every
member-function case through `amnesia` with this runtime and against the
host. Nothing the compiler imports reads a generated file: `npm run gen`
deletes every `gen.*` before it regenerates, and a generator whose own
imports needed one could not start.

## Moving a name from the marker to a body

1. Write the body here, with its proof case by case, and `npm start
   compile` accepting the module.
2. Remove the interpreter's native case in `edag/value/method`, so the
   body is what answers it there.
3. Remove NaNVM's entry in `vm/lambda` and the typed method under it, or
   keep it as an optimization with a measurement that justifies it.
4. `npm run gen`, then the corpus: the name's cases in `nanvm/member` run
   the body through `amnesia` and on NaNVM.

`startsWith` is the first.

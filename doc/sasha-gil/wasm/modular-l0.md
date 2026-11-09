# A modular L0

**Proposed** on 2026-11-09, from the owner's idea while writing the
[modular runtime](./modular-runtime.md) memo. Nothing here is decided yet.

The [L0 design](./l0-design.md) is one list of 32 functions and 4
constants, imported from one module, `fjs:l0`. The modular runtime adds a
String module whose functions are inlined over slots that the module
chooses. This note takes the next step: L0 itself becomes a set of runtime
modules, and the String module is one of them. A runtime is then a choice
of one variant of each module.

## Summary

| Module | L0 functions | Kinds it owns | Depends on |
| --- | --- | --- | --- |
| Any | the constants, `kind`, `to_f64`, `from_f64`, `to_bool`, `from_bool`, `dup`, `drop`, `same` | `undefined`, `null`, boolean, number | none |
| String | `make_string`, `read_units`, `unit`, `from_unit`, `concat`, `substring`, `join`, `length`; in template form also `unpack` | string | Any; Containers, for `join` |
| BigInt | `make_bigint`, `sign`, `read_words`, `length` | bigint | Any |
| Containers | `begin_array`, `begin_object`, `push`, `push_property`, `seal`, `length`, `item`, `key`, `find` | array, object | Any |
| Functions | `make_function`, `call`, `throw`, `frame`, `text`, `length` | function | Any, Containers |

Every module comes in two forms:

- **Import form:** each function is an import of the runtime, as in L0 today.
- **Template form:** each function is a template that the compiler inlines,
  over locals whose number and types the module's manifest gives
  ([inline fragments](./inline-fragments.md#runtime-modules)).

A program built with every module in import form is today's portable
program, and it runs on any runtime.

## Design choices

### 1. Five modules, cut by kind

- **Pick:** a module owns the kinds in the table above, and every function
  that needs to know how those kinds are stored. Any owns the encoding of
  the `i64` itself: the kind tag, the scalars that live inside the `i64`, and
  reference counts. `same` is in Any too, because reference identity is a
  question about the encoding, not about a container's contents.
- **Alternatives:**
  - Cut by L0 design group: scalars, bytes, strings, containers, lifetime.
    But that separates `make_string` from `unit`, which have to agree on a
    string's layout.
  - Make Identity a module of its own. It would hold one function.
- **Why:** what can vary between runtimes is how a kind is stored. Each
  experiment then swaps one module. For example, the three String variants
  of the modular runtime memo differ only in the String module.

### 2. `length` splits into one function per module

- **Pick:** L0's `length` answers for five kinds
  ([L0 design §18](./l0-design.md#18-what-length-item-and-key-mean-for-each-kind)).
  It becomes four functions: the `length` of String, BigInt, Containers and
  Functions. The compiler already knows a value's kind wherever it calls
  `length`: an L1 body calls it after a `kind` test or a cast, and the host
  calls it after `kind` ([§21](./l0-design.md#21-the-host-is-an-l0-client)).
  So it picks the module by the known kind.
- **Alternative:** keep one `length` in Any, and let it call the module that
  owns the kind. Any would then depend on every other module.
- **Why:** the dependencies stay a tree with Any at the root. Each `length`
  also reads a layout that only its own module knows. L0 grows from 32
  functions to 35 in import form.

### 3. Each module has an import name and a version

- **Pick:** the import module names become `fjs:l0/any`, `fjs:l0/string`,
  `fjs:l0/bigint`, `fjs:l0/containers` and `fjs:l0/functions`. The
  `fjs.abi` custom section
  ([L0 design §15](./l0-design.md#15-naming-and-versioning)) lists one
  version for each module, such as `l0/string/1`, instead of one `l0/1`.
- **Alternative:** keep the single name `fjs:l0`, and version only the
  whole list.
- **Why:** a module can then change, for example when `unpack` is added to
  String, without a new version of the others. Function names also become
  local to their module, so the four `length` functions keep one name.

### 4. The kind tags are shared by all modules

- **Pick:** the tags of the L0 summary (0 `undefined` up to 8 function)
  stay one ABI-wide table, versioned with Any. Any's `kind` answers them,
  whichever module stores the value.
- **Why:** a tag names a kind, not a layout. Programs test kinds without
  knowing which String or BigInt module the runtime has.

### 5. Import form is the portable mode

- **Pick:** a module in import form needs no slots. Its unpacked value is
  the `any` itself, and its reads are calls of the runtime. For String, that
  means `unpack` is null, and the memo's `length` and `at` are L0's
  `length` and `unit`, called through imports. That is the
  [memory-saving module](./modular-runtime.md#naive-nan-cpu-saving-and-nan-memory-saving-string-runtime-modules)'s
  shape, with calls in place of inlined decoding.
- **Why:** this answers
  [README open question 8](./README.md#open-questions). A function that is
  called, not inlined, never takes an offset, because only the template
  form has slots, and templates are always inlined. No shadow stack is
  needed in either form.
- **Mixing forms:** a program may use the template form of String and the
  import form of every other module. A module in import form may be
  inlined later as a fragment, as L0 functions can be today, without
  changing the program.

### 6. A manifest per module

- **Pick:** each variant of a module has a manifest, in the runtime's
  `fjs.inline` custom section
  ([inline fragments](./inline-fragments.md#form)). It holds:
  - the module's name and version;
  - the modules and versions it requires, such as "Any, NaN encoding";
  - in template form, the slot types: a list of `i32`, `i64` or `f64`
    locals, because WASM declares each local with a type;
  - for each function, an import name and signature, or a template, with
    one template per target (WASM, and later Rust);
  - in template form, the runtime build whose memory layout the templates
    read.
- **Why:** an emitter needs all of these, and a loader needs the last one
  to refuse a program built for another runtime
  ([inline fragments, Open](./inline-fragments.md#open)).

### 7. What stays the same

- **Lifetime.** Every module follows
  [L0 design §10](./l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results).
  An unpacked value in template form borrows its source `any`, as the
  String module's does, so `unpack` never costs a reference count.
- **Memory.** Strings and bigints still cross through the program's
  scratch space ([§5](./l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)).
  A template may read the runtime's own memory, which it imports.
- **Host-only exports.** `enter`, `leave`, `has_thrown`, `thrown` and
  `recover` ([§21](./l0-design.md#21-the-host-is-an-l0-client)) belong to
  the runtime as a whole, not to a module, because `recover` frees values
  of every kind.
- **The FunctionalScript view.** The intrinsics of
  [§17](./l0-design.md#17-a-functionalscript-view-of-l0) keep their names.
  Each one lowers to its module's function. The view's `length` lowers to
  the module of the kind its cast gave.

## Example runtimes

| Runtime | Any | String | BigInt | Containers | Functions |
| --- | --- | --- | --- | --- | --- |
| Any runtime, portable program | import | import | import | import | import |
| NaNVM today, specialized | Naive, template | Naive, template (one pointer slot) | import | import | import |
| NaN, memory-saving | NaN, template | NaN, no slots, decodes on each read | import | import | import |
| NaN, CPU-saving | NaN, template | NaN, length and units in slots | import | import | import |

The last three rows are the String variants of the modular runtime memo.
Only Any and String change between them.

## The code IR

The IR's tables ([IR choice 4](./ir-design.md#4-every-operation-comes-from-a-table))
follow the modules. The `l0` table holds the import-form rows of every
module, each named with its module, so `l0.string.length` and
`l0.containers.length` are two rows. The `str` table holds String's
template-form rows. If BigInt gets a template form too, it follows `str`:
the module declares a type and its rows, and the IR names them
([IR, least sure](./ir-design.md#where-this-draft-is-least-sure)).

## Where this draft is least sure

- **The split of `length` (2).** It assumes the kind is known wherever
  `length` is called. A use with an unknown kind would need L1, or a
  dispatching `length` again.
- **`join` in String (1).** It reads an array and makes a string, so
  String depends on Containers. Moving `join` to Containers would make
  Containers depend on String instead.
- **`at` and `unit` are one function.** The memo calls it `at`, and L0
  calls it `unit`. One of the two names should go.
- **Five import names (3).** WASM allows any module name, but a runtime in
  JavaScript then exports five import objects instead of one.

# MVP Roadmap

**Priority:** P1
**Status:** open

The primary focus is to get to MVP ASAP: a minimal end-to-end pipeline where FJS
source is parsed (FJS), serialized as an AST, and loaded and executed by
`nanvm-lib` (Rust).

See [`todo/lang/`](../../todo/lang/README.md) for language details. Details for
individual items below are added only after discussion.

## Serializable format: AST, not bytecode

We lean towards **AST** instead of bytecode as the serializable standard
representation of functions, because we want a simple, standard, serializable
representation of FJS functions. For FJS, that means JSON or DJS. While we
would like to have a JSON representation of an FJS function, we may prefer to
serialize it into **CBOR**, because we need a precise number representation
(IEEE 754 double).

## Tasks

### P1

- [ ] **Complete all basic FunctionalScript operators** (Rust).
      Current status: [operator tables in `nanvm-lib/README.md`](../README.md).
      Spec: [operators](../../todo/lang/2340-operators.md).
- [ ] **Deserializer** from the serializable format (AST preferred over
      bytecode, see above) (Rust).
      Related: [fs-vm-load-save](./fs-vm-load-save.md).
- [ ] **Parser**, using [`fs/bnf/`](../../fs/bnf/README.md) (FJS).

### P2

- [ ] **Basic control operator `?:`** (Rust).
- [ ] **Nested functions** (function frame) (Rust).
      See [function](../../todo/lang/3110-function.md),
      [function-frame](../../todo/lang/3111-function-frame.md).
- [ ] **AST serializer** (FJS).

### P3

- [ ] **Control statements**: `if`, `while`, etc. (Rust).
      See [`todo/lang/README.md` §3.2](../../todo/lang/README.md).

### P4

- [ ] **Generators**, etc. (Rust).

## Open questions

1. **Commit to AST?** The deserializer task says "bytecode or AST" while this
   document leans AST. If AST is the decision, the bytecode-oriented docs
   ([`todo/lang/README.md` §9](../../todo/lang/README.md),
   [call-like-instructions](../../todo/lang/9100-call-like-instructions.md),
   [function-frame](../../todo/lang/3111-function-frame.md), and the
   "Compiler (codegen): bytecode ISA" row in
   [`todo/plan/roadmap.md`](../../todo/plan/roadmap.md)) need updating.
2. **Which encoding does the P1 Rust deserializer consume first** — CBOR,
   JSON/DJS text, or both?
3. **AST schema as its own task.** The parser (P1, FJS), the serializer (P2,
   FJS), and the deserializer (P1, Rust) all depend on one agreed AST schema
   (tags/shapes). Is the tag table in
   [`todo/lang/README.md`](../../todo/lang/README.md) the spec of record, or
   does the schema need its own design issue first?
4. **Priority mismatch.** The Rust deserializer is P1 but the FJS AST
   serializer producing its input is P2. Until the serializer lands, does the
   Rust side test against hand-written AST data?
5. **Short-circuit operators.** `&&`, `||`, `??` need lazy evaluation like
   `?:`. Do they belong to the P1 "basic operators" task (eager, value-level)
   or to the P2 control task (lazy, expression-level)?

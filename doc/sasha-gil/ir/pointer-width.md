# Pointer width in the NaN box

Proposed, not decided. This note answers a review finding on
[type-system.md](./type-system.md#what-the-checker-proves) and waits for
the owner's choice.

## The problem

In the NaN box of [type-system.md](./type-system.md#the-notation-is-the-nan-vm-readmes),
a reference variant is `0111_1111_1111_0100_p…p_10`: 16 fixed bits on top,
the 2 tag bits at the bottom, and 46 bits of `p` between them. The note
says a 4-aligned pointer of up to 48 bits fits there.
[Sergey's NaN VM README](../../sergey-shandar/nanvm/README.md#reference)
makes the same assumption.

That holds on WASM, where `p` is an `i32` offset into linear memory. It
does not hold for a native Rust pointer. Rust promises the alignment of
the type behind a `Box` or an `Rc`, and nothing about the width of the
address. Cases where a heap pointer has bits above bit 47 (from memory,
not checked against current platform docs):

- **AArch64 Android.** Since Android 11, the system allocator tags the top
  byte of 64-bit heap pointers, and the hardware ignores it (top-byte
  ignore). With memory tagging (MTE) on newer devices, bits 56 to 59 hold
  a tag chosen per allocation, and the pointer must keep it to be used.
- **x86-64 with 5-level paging.** Linux hands out user addresses above
  2^47 only when a program asks for them, so the default allocator stays
  below. That is a convention, not a promise.
- **Capability hardware such as CHERI.** A pointer is 128 bits, and no
  packing into 46 bits can keep it.

Today no production code is affected. NaNVM's runtime value is the
`Naive` enum over `Rc`, and its only NaN packing,
[`nanenum.rs`](../../../nanvm/lib/src/nanenum.rs), is test-only and also
assumes 48 bits for an `Rc`. The question is for the Rust emitter that
[type-system.md](./type-system.md#emitting-wasm-and-rust-from-the-same-module)
plans, whose `ref(O)` row is "a pointer from `Rc::into_raw` or
`Box::into_raw`".

## Options

### A. The Rust target gets a heap region and stores offsets

The Rust target reserves one region of address space at start-up and
allocates every heap object in it, as the WASM target does in linear
memory. `p` holds the offset from the region's base, without its
alignment bits. `stat(O)` is an offset into a second, static region, the
counterpart of a WASM data segment, so `heap` and `lit` keep their sign
bit.

- **For:** one layout on both targets, and the same `any` bits for the
  same heap, so the targets can be tested against each other bit for bit.
  It works on every host above, CHERI included, because no pointer is
  packed. The checker's rule becomes "an offset below 2^48", which each
  target's allocator guarantees by construction. A bound check alone does
  not make bits from outside safe on Rust: an offset inside the region can
  still name an object's interior, a freed slot or an object of another
  type, and turning it into `&O` is undefined behavior. WASM only bounds
  the damage to its sandbox. So on Rust, `try_from_bits` refuses reference
  variants, and references cross the host boundary only as handles, as in
  NaNVM's `l0::abi`
  ([open question 7](./type-system.md#open-questions)).
- **Against:** the Rust target needs its own allocator, the same job as
  the WASM target's ([open question 1](./type-system.md#open-questions)),
  instead of Rust's. A dereference is base plus offset, one add with the
  base in a register or a static. A reserved region, rather than a
  growable `Vec`, keeps addresses stable, so the emitted Rust can still
  hand out `&O`. The region's size is a target parameter, smaller on
  32-bit hosts.

A variant of A puts the region in one Rust buffer, such as a `Vec<u64>`,
and reads it through indexed loads and stores in safe code, never through
`&O`. It fits an IR that lowers in stages, where the last stage before
the emitters has only integers, floats and memory: both emitters then
read the heap the same way. A bad offset becomes a bounds-check panic or
a wrong value inside the buffer, as in WASM, and never undefined
behavior. So `try_from_bits` could accept reference variants again. The
buffer may grow and move, because no address is held across an
allocation. Each access pays a bounds check, which the compiler removes
where it can prove the index in range.

### B. Native pointers, checked when packed

Keep `Rc::into_raw`, and trap at the constructor if the pointer has a bit
outside `p…p` or a low alignment bit.

- **For:** the smallest change, and Rust's allocator and `Rc` stay.
- **Against:** the program fails at run time on Android and CHERI. The
  check is a guard, not a layout. While any target packs native
  pointers, the check must stay in release builds: a pointer that loses
  its high bits comes back as an invalid `Rc`, which is undefined
  behavior. Under A it becomes a debug assertion on the allocator.

### C. Strip the tag and restore it

Save the top byte when packing and put it back when unpacking.

- **For:** keeps native pointers on Android without memory tagging, where
  the tag is one value per process.
- **Against:** an MTE tag differs per allocation and needs 4 more bits,
  which the box does not have. It is per-platform code, and it does not
  help CHERI.

### D. A handle table

`p` is an index into a table of native pointers, as the i64 handles of
NaNVM's `l0::abi` already are.

- **For:** works everywhere, and `Rc` stays.
- **Against:** an extra load on every dereference, and the table is one
  more counted resource with its own free list. The region of A is the
  same idea without the indirection.

### E. A layout per target

The Rust target declares its own `any`, for example a tag and a full
pointer. [L0](../wasm/l0-design.md) already leaves the encoding of `any`
to the runtime, so this is allowed.

- **For:** each target uses its natural pointer.
- **Against:** two layouts to declare and prove, a 128-bit or tagged
  `any` on Rust, and no bit-for-bit comparison between targets.

## Recommendation

A. Until A lands, the Rust emitter that still uses `Rc` keeps B's check
in release builds. If chosen, [type-system.md](./type-system.md) changes in three
places: the checker rule says "offset" instead of "pointer", the Rust
column's `ref(O)` and `stat(O)` rows name the regions, and the floor
lists the Rust allocator next to the WASM one. The Rust step-3 question
in NaNVM, loader-owned memory against Rust's allocator, gets the same
answer.

## 131. An allocator for `nanvm` that doesn't panic.

**Priority:** P3
**Status:** open

An allocator for `nanvm` that doesn't panic. Instead, it should return `Result<T, Any>`.

### Sites that still abort

`spread_array` reserves its elements through `Vec::try_reserve` and throws the
`RangeError` of an array whose elements the machine cannot hold
(`vm/unstable/mod.rs`; the test `spread_array_unbacked` is the abort it used to
be: `memory allocation of 103079215080 bytes failed`). It is not fully
fallible: the array it then builds with `to_array` is a second allocation of
the same size (`naive/container.rs`'s `new` collects into an `Rc<[Any]>`), so a
machine that holds the elements but not a copy of them still aborts, which is
the second kind below.

Every other single allocation sized from a program-controlled count, operand
or receiver is one of three kinds. This is a snapshot, found with
`git grep -n -E "with_capacity|vec!\[[^]]*;|repeat_n|\.resize\(" -- 'nanvm-lib/src/*.rs'`
and by reading the container constructors; repeat it before calling the task
done, since a `Vec` that grows by `push` can abort at any growth step too.

- **A buffer the operation allocates itself, larger than its inputs.**
  `BigInt`'s `*` (`vm/bigint/mul.rs`) sizes its result from the operands'
  lengths, `lhs + rhs + 1` words, through `common/vec.rs::with_default`, an
  infallible `Vec::with_capacity`, and has no size limit. `<<` already
  refuses a result past `MAX_WORDS` and reserves fallibly
  (`vm/bigint/shl.rs`); it is the model.
- **A copy of an input that is already in memory.** These cannot be made
  larger by the program, but a machine that holds the input and not a second
  copy of it still aborts: `toSorted`'s merge buffers
  (`vm/array/to_sorted.rs`, `Vec::with_capacity(left.len() + right.len())`),
  the quotient of `/` and `%` (`abs_divmod_vec`, `vec![0; numer.len()]`), and
  the padded words of the bitwise operators (`twos_complement_words`).
- **A container the constructor allocates.** `spread_array`'s final
  `to_array`, and `array/create.rs`'s `create`, which bounds the length at
  `2³² − 1` and then builds the array from an iterator, and so do the string
  builders that call it: `repeat`, `padStart`/`padEnd`, `concat`. `<<` meets
  this one too, in its second allocation (the TODO in `shl.rs`).
  `'a'.repeat(2 ** 32 - 1)` is a count under the limit that the machine may
  not back.

The first kind is local to `*`, but a fallible `*` changes its signature:
`Mul for BigInt` has `Output = Self` and no `RangeError` of its own, where `<<`
returns a `Result`. The second kind needs a fallible `Vec` reservation at each
site (`try_reserve_exact`, as `<<` does). The third needs a fallible container
constructor in `IVm`, which is the general task.

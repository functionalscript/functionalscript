## Remove the frame from a static function

**Priority:** P3
**Status:** open

### Problem

A [`StaticFunction`](../src/vm/static_value.rs), a function that is a
constant of its module, has a frame:

```rust
pub struct StaticFunction<A: IVm> {
    pub code: StaticCode<A>,
    pub length: u32,
    pub frame: &'static StaticArray<A>,
    pub text: Option<&'static StaticString>,
}
```

`functionDeclaration` in
[`fjs/rust/serializer`](../../../fjs/rust/serializer/module.f.js) writes
what the function captured into it, and the function's code reads it back
by position:

```rust
static FUNCTION_20: StaticFunction<A> = StaticFunction { code: |_self, _args| {
    ...
    Any::call(A::frame(_self)[0].clone(), ...)
}, length: 0, frame: &StaticArray(&[StaticAny::Function(&FUNCTION_12)]), text: Some(&LITERAL_2) };
```

Everything in such a frame is a static itself: that is what makes the
function a constant. So the frame holds nothing the code could not name.
`A::frame(_self)[0]` is `FUNCTION_12`, and the code can say so:

```rust
Any::call(Function::from_static(&FUNCTION_12).to_any(), ...)
```

What the frame costs:

- A load of the function wraps the frame as well as the function.
  `Function::from_static` in [`naive`](../src/naive/function.rs) makes an
  `Array::from_static(value.frame)` each time, and a read of a slot goes
  through it.
- The code is written against a position in a frame, where it could be
  written against the constant, which is the one that says what it reads.
- It is the only thing that would ask for a group of static functions.
  Functions that refer to each other are to be a function group
  ([#4120](https://github.com/functionalscript/functionalscript/pull/4120)),
  one frame shared and one counted allocation. A Rust `static` names
  another whichever is written first, so two static functions that refer
  to each other are two statics, each naming the other in its code, with
  nothing allocated and nothing counted. That holds only while a static
  function reaches a sibling by name and not through a frame it shares:
  with no frame there is no `StaticGroup` to design.

### Proposal

A static function is its code, its `length` and its text. The serializer
writes a captured constant where the code reads it, as the static it is,
and `StaticFunction` loses `frame`.

A function made while the program runs keeps its frame: `IVm::static_function`
takes one, and `IVm::frame` answers it. The frame of a function loaded from
a descriptor is then empty, or `IVm::frame` is not asked of one at all.

### What a design has to settle

- **One code for both.** A function's code is `StaticCode<A>`, the same
  type for a constant and for a function made at run time. A body written
  for a descriptor names statics, and one written for
  `IVm::static_function` reads its frame; whether one body serves both is
  decided by the serializer today, `staticFrame` choosing the descriptor.
  A body that names its constants cannot be handed a frame instead.
- **`self`.** A static function that reads itself names its own
  descriptor, as it would name a sibling's.
- **The runtime value.** A compiled module takes the runtime as a value,
  and a function that reads it holds it in its frame as a slot of a
  function made at run time. Whether that keeps such a function from being
  a descriptor is unchanged by this.

### Tasks

- [ ] The serializer writes a captured constant in the code of a static
      function, by its static's name, and an empty frame.
- [ ] `StaticFunction` without `frame`: the descriptor, `IStaticVm::load_function`
      in every VM, and the hand-written descriptors in the tests.
- [ ] Regenerate the native outputs, and measure what a load of a function
      costs before and after.

### Related

- [`static-constants.md`](./static-constants.md) — the descriptors this
  one is among.
- [`native-statics-table.md`](../../../fjs/rust/serializer/todo/native-statics-table.md)
  — the serializer's other spelling of a function over static code.
- [#4120](https://github.com/functionalscript/functionalscript/pull/4120) —
  the function group, which needs no static counterpart.

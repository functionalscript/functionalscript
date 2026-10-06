## Handle host string-allocation failures at the interpreter boundary

**Priority:** P4
**Status:** open

### Problem

The represented method dispatcher still uses host string operations. Requests
such as `'x'.padStart(Infinity, '0')`, its `padEnd` counterpart, and finite
requests such as `'x'.repeat(2 ** 53 - 1)` can exceed the host's string capacity.
The resulting host allocation/maximum-length exception currently escapes the
interpreter instead of becoming a represented result.

These are resource failures, distinct from implemented language failures.
Padding applies `ToLength`, which clamps infinity to `2 ** 53 - 1`; it does
not prescribe an error for infinity. An empty padding string still returns
the receiver. In contrast, `repeat(Infinity)` has a specified range failure
and already returns `error(['undefined'])`.

### Tasks

- Settle resource-failure handling with the deferred interpreter resource work;
  do not add an arbitrary string limit or an infinity-only admission check.
- Preserve padding order: an already long enough receiver skips fill
  conversion; a demanded conversion failure propagates unchanged; empty fill
  returns the receiver even for an infinite target.
- Cover oversized finite padding and repetition as well as infinite padding
  when that boundary is implemented.

### Related

- [Review on #2590](https://github.com/functionalscript/functionalscript/pull/2590#discussion_r4191391985).
- [Deferred interpreter resources](../../../../compiler/todo/bound-edag-interpreter-resources.md).
- [EDAG value scope](../../../values.md#scope-and-deferred-work).
- [ECMAScript ToLength](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-tolength)
  and [StringPad](https://tc39.es/ecma262/multipage/text-processing.html#sec-stringpad).

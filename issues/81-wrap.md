# 81 Wrap

Currently, nanvm_lib relies on traits, such as `Any`, `Object`, `Array`, and `String16`. The problem is that one type can implement multiple traits, for example, `struct A { ... }` can implement both `String16` and `Object` traits. It makes implementing generic operators, serialization, etc., challenging for the traits. We need concrete wrap types. For example, `struct Any<T: Vm>(T::Any);`. In this case, we can implement different operators and traits for the generic `Any<T>` type instead of a trait.

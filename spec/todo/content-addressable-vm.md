# 6. Content-Addressable VM

Formerly §6 of the main [spec README](../README.md).

See also [Unison](https://www.unison-lang.org/), [ScrapScript](https://scrapscript.org/), [Dhall](https://dhall-lang.org/). And ZK: [Lurk](https://filecoin.io/blog/posts/introducing-lurk-a-programming-language-for-recursive-zk-snarks/).

Note that Dhall is not Turing-complete: it is a [total](https://en.wikipedia.org/wiki/Total_functional_programming) programming language, so every Dhall program is guaranteed to terminate. FunctionalScript as a CAPL can also have a total-functional subset, if needed. Another, more practical, option is that the VM can limit execution by time and memory parameters.

The main target is run-time performance.

Hash function: most likely SHA256 because there is a lot of hardware support from modern processors.

Hash structure: we will use several initial hashes for a compress function.

We may use CDT for huge arrays, objects, strings, and BigInts.

The first bit of a hash is reserved for a tag. If the tag is `0`, we have raw data with `1` at the end. A hash with all zeroes is used for `undefined`. If the first bit is `0`, then the value is a hash. So, we have only 255 bits for a hash.

Because we use tagged hash, we can keep small values in a `nanenum`. So it may reuse a lot from non-content addressable VM and ref-values can keep a hash value inside.

Instead of an address, we can use a prefix, hash. 48 bits should be enough for most cases. However, we also need a mechanism to resolve collisions (even if they are rare). For example, our value can be an enum like this

```rust
enum Value {
   Data(...),
   Hash(u48),
   Ref(u48),
}
```

However, while the `===` operation can be faster, `Value::Hash` is slower when we need to access the object's internals because it requires two dereference operations. So, we may come back to using only references.

```rust
enum Value {
   Data(...)
   Ref(u48)
}
```

The collision probability for 48 bits is 50% for `16777216 = 2^24` hashes (birthday attack).

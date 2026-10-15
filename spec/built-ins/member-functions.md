# Built-in Member Functions

**Status:** implemented

The represented EDAG interpreters and the Rust VM implement the admitted
member functions. The native completeness table checks every allowed
receiver-type/name pair against the compiler's list
([member-functions](../../nanvm/lib/todo/member-functions.md)).

| Receiver | Admitted methods |
| --- | --- |
| Array | `at`, `concat`, `every`, `filter`, `find`, `findIndex`, `findLast`, `findLastIndex`, `flat`, `flatMap`, `includes`, `indexOf`, `join`, `lastIndexOf`, `map`, `reduce`, `reduceRight`, `slice`, `some`, `toReversed`, `toSorted`, `toSpliced`, `with` |
| String | `at`, `charAt`, `charCodeAt`, `codePointAt`, `concat`, `endsWith`, `includes`, `indexOf`, `isWellFormed`, `lastIndexOf`, `padEnd`, `padStart`, `repeat`, `replace`, `replaceAll`, `slice`, `split`, `startsWith`, `substring`, `toLowerCase`, `toUpperCase`, `toWellFormed`, `trim`, `trimEnd`, `trimStart` |
| Number | `toExponential`, `toFixed`, `toPrecision` |
| Object, Array, String, Number, Boolean, BigInt, Function | `toString` |

Methods follow JavaScript's argument, callback and coercion rules. Array
callbacks can be closures, missing arguments differ from explicitly passed
`undefined` where the method specifies that distinction, and string positions
count UTF-16 code units. Each is defined once, in
[`fjs/js/runtime`](../../fjs/js/runtime/README.md): as a FunctionalScript body
every executor answers it from — `startsWith` the first — or, until its body
is written, as a name each executor implements natively. Mutation methods, iterator-producing methods,
locale-sensitive operations, regular-expression methods and namespace APIs
such as `Array.isArray` remain outside this set. The complete name-by-name
admission rationale is in [prototype names](../../fjs/js/prototype/README.md).

Native execution has these limits:

- Number and bigint `toString` accept radices 2–36. Bigints and integral
  numbers convert exactly; a fractional number with a nondecimal radix is
  refused. Exact large-integer radix digits can differ from a host engine's
  implementation-defined formatting.
- `toSorted` with an inconsistent comparator has the order the executor's
  sorting algorithm gives it, as ECMAScript permits.
- `toLowerCase` and `toUpperCase` are the Unicode Default Case Conversion at
  **Unicode 17.0.0**, the version the pinned Rust standard library carries
  and `nanvm-lib` asserts at compile time
  ([prototype names](../../fjs/js/prototype/README.md#unicode-version)). A host
  engine on another Unicode version may case a character assigned since
  then differently. A lone surrogate, which has no case, is kept.
- Native strings hold at most 2³² − 1 UTF-16 code units; a host engine may
  exhaust its resources sooner.
- Compiled functions carry EDAG-derived text. A native function without
  associated text is refused when conversion requests it
  ([function-source exception](../principles/README.md#function-source-representation-exception)).

The native [array](../../nanvm/lib/src/vm/array/README.md) and
[string/number](../../nanvm/lib/src/vm/string/README.md) documentation gives the
method-specific details and implementation-defined cases.

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Array objects](https://tc39.es/ecma262/#sec-array-objects), [String objects](https://tc39.es/ecma262/#sec-string-objects), [Number objects](https://tc39.es/ecma262/#sec-number-objects)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects>

## Add an isPlainObject pattern instruction

**Priority:** P3
**Status:** open

### Problem

FJS PL currently admits null, ordinary objects with `Object.prototype` as
their prototype, and arrays as its object types. Future subtypes, such as
`Map`, need a way for existing algorithms to refuse values they do not support.
Testing only `typeof value === "object"` does not distinguish these categories.

### Proposal

Recognize this function as a pattern instruction, like `entry` or `refMap`:

```javascript
const isPlainObject = value =>
  value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;
```

It returns true only for an ordinary object whose prototype is exactly
`Object.prototype`. It returns false for null, arrays, primitives, and future
object subtypes such as `Map`. Objects with a null prototype are also excluded.

The complete function pattern specifies the instruction; it does not expose
`Object.prototype` or general prototype reflection as FJS operations. Recognize
it after parsing statement and expression structure and validating bindings,
following the existing pattern-instruction rules.

### Benefits and drawbacks

- Existing algorithms can explicitly accept ordinary objects and refuse future
  subtypes without changing when those subtypes are introduced.
- The pattern is valid JavaScript with the same result on current FJS values;
  no new keyword or general reflection API is needed.
- It adds a recognized pattern and a primitive that compilers and runtimes must
  support. Its exact-prototype test deliberately excludes null-prototype
  objects rather than broadening the meaning of ordinary object.

### Tasks

- [ ] Obtain and record explicit language-design approval before implementation.
- [ ] Specify the accepted function pattern and binding rules consistently with
  existing pattern instructions.
- [ ] Implement recognition and runtime support for the predicate.
- [ ] Add proofs for ordinary objects, null, arrays and primitive values, and
  refusal of prototype reflection outside the complete recognized pattern.
- [ ] Document the instruction and its use to refuse unsupported object subtypes.

### Related

- [Language principles](../spec/principles/README.md) — pattern recognition and
  JavaScript compatibility.
- [Entry patterns](../spec/property-access/entries/README.md) — existing
  function patterns that lower to primitives.
- [Statement-aware intrinsics](../fjs/compiler/parser/todo/statement-aware-intrinsics.md)
  — parsing and binding requirements for pattern instructions.

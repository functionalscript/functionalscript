## 37. Language Design: references in containers.

**Priority:** P3
**Status:** open

FJS had no way to store references (objects/functions) in a container with fast search capabilities. The reference map below now finds one; a container of references with a size and an order is still the program's own to build. The options considered:

- add `Map` to the language
- use content (serialization). This can be slow with a non-CA VM. Functions are still hard to serialize.
- recognize a [reference map](../spec/built-ins/reference-map/README.md): one
  function whose calls read a reference key or return a new map, exposing no
  label. **Implemented.** It finds a reference in `O(log n)`; size,
  iteration and removal stay with the program's own containers, and the
  [design record](../spec/design/object-identity.md#reference-map) says why
  exposing reference IDs as bigints was dropped.

### Related

- [Object identity](../spec/design/object-identity.md) — the same question in the
  spec roadmap: functions as keys, and `Map` behind ownership tracking.

## 37. Language Design: references in containers.

**Priority:** P3
**Status:** open

Currently, FJS has no way to store references (objects/functions) in a container with fast search capabilities. Several options:

- add `Map` to the language
- use content (serialization). This can be slow with a non-CA VM. Functions are still hard to serialize.
- expose reference IDs as bigints through the proposed
  [`id` helper](../spec/todo/object-identity-id.md), backed in JavaScript by a
  shared `WeakMap` and counter. Its admission as a function pattern versus a
  runner effect remains a language-design decision. The feature and its
  [reversible obfuscation follow-up](../spec/todo/object-identity-id-obfuscation.md)
  are tentative v2 candidates, not v1 requirements.

### Related

- [Object identity](../spec/design/object-identity.md) — the same question in the
  spec roadmap: functions as keys, and `Map` behind ownership tracking.

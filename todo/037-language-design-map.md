# 37. Language Design: references in containers.

**Priority:** P3
**Status:** open

Currently, FS has no way to store references (objects/functions) in a container with fast search capabilities. Several options:

- add `Map` to the language
- use content (serialization). This can be slow with a non-CA VM. Functions are still hard to serialize.

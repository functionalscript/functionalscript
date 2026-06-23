# UTF-8 strings instead of UTF-16

**Priority:** P3
**Status:** blocked

### Problem

JavaScript strings are UTF-16, which exposes surrogate pairs and makes byte-level string
handling error-prone and non-portable. FunctionalScript would benefit from UTF-8 semantics.

### Trigger

Unblocked when ECMAScript adopts a UTF-8 string primitive or a standard `StringView`/`Uint8Array`-backed string type that JavaScript engines expose natively.

### Related

- https://github.com/tc39/proposal-is-usv-string

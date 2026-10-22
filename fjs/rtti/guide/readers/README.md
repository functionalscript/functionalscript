# Readers

**Status:** implemented

A schema is read against a value by one of three readers, which accept
exactly the same values:

| Reader | A success carries |
| --- | --- |
| `parse(s)(value)` | a value built from what `s` declares |
| `validate(s)(value)` | the value it was given |
| `validate(toData(s))(value)`, the data form's | the value it was given |

## Pages

- [`parse` and `validate`](./parse-and-validate/README.md): what each reader
  is for, and how their results differ
- [Errors](./errors/README.md): the `{ path, message }` a refusal carries
- [What the readers assume of a value](./assumptions/README.md): DataJS
  values, and what that leaves to the host boundary

## Reference

- TypeScript: [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- JSON Schema: [validation](https://json-schema.org/understanding-json-schema/basics)

## Where it is implemented

[`parse`](../../parse/module.f.mjs), [`validate`](../../validate/module.f.mjs),
the data form's `validate` in [`data`](../../data/module.f.mjs), and the kernel
they share in [`common`](../../common/module.f.mjs).

# 66K-virtual-large-file-support. Virtual filesystem should support files larger than `maxLengthBytes`

**Priority:** P3
**Status:** open

## Problem

The virtual node runner (`fs/effects/node/virtual/module.f.ts`) stores every
file as a single `Vec`. `Vec` is capped at `maxLengthBytes` (128 KiB), so any
virtual file larger than that cannot be represented. This makes it impossible to
write proof tests for large-file upload paths without hitting the cap.

The streaming `casUpload` pipeline is specifically designed to handle files
larger than 128 KiB, but any proof test that feeds it a file through the
virtual runner is limited to 128 KiB, defeating the purpose of the feature.

## Proposal

Change the virtual filesystem's file representation from a single `Vec` to an
array of `Vec` chunks (e.g. `readonly Vec[]`):

```typescript
// before
export type Entity = Vec | Dir | JsModule

// after
export type Entity = readonly Vec[] | Dir | JsModule
```

`readBytes(path, offset, size)` would locate the right chunk(s) from the array
and return the requested slice, allowing arbitrarily large files to be stored
in the virtual filesystem without any single allocation exceeding `maxLengthBytes`.

Callers that write a single `Vec` (e.g. existing tests that set
`root: { 'myfile': content }`) should continue to work — either by wrapping
`Vec` automatically in `[content]`, or by keeping `Vec` as a special-case
alias for `[Vec]`.

## Tasks

- [ ] Change the virtual `Entity` file type from `Vec` to `readonly Vec[]`
- [ ] Update `readBytes` virtual impl to read across chunk boundaries
- [ ] Update `writeFile` virtual impl to store content as `[value]`
- [ ] Update `readFile` virtual impl to concatenate chunks (preserving the
      128 KiB cap for `readFile` itself, since it reads everything at once)
- [ ] Update all existing virtual test fixtures to use the new representation
      (or add an automatic coercion from `Vec` to `readonly Vec[]`)
- [ ] Add a proof test that uploads a file larger than 128 KiB through the
      virtual runner

## Related

- [i66J-cas-streaming-upload-design](./66J-cas-streaming-upload-design.md) — the upload pipeline that motivates this

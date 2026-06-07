# 122. Consider adding a new file type for applications.

**Priority:** P3
**Status:** irrelevant

Consider adding a new file type for applications. For example, `node.f.ts` or `app.f.ts`.
These files should have `export default` with type `NodeProgram`.
Then we may have other application files, for example, `web.f.ts`.

Superseded by [i664-file-type-conventions](./664-file-type-conventions.md), which
tracks the broader file-naming convention and should use the current
`export const main` entry-point convention rather than this issue's older
`export default` wording.

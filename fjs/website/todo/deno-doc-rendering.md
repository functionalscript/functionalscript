## Improve Deno's source and JSDoc rendering

**Priority:** P3
**Status:** open

The pinned Deno 2.8.3 HTML generator retains JSDoc descriptions but often
omits signatures declared using function-valued `@type` annotations. For
example, SHA-2's `framing` shows an unnamed parameter instead of `FramingInit`.
Explicit public `types.ts` entrypoints provide the declaration reference.

Native source icons point at build-local `file:` URLs. Relative Markdown
links authored for the source tree can also resolve incorrectly inside the
generated reference. Every page has a working return-to-site link, and module
and symbol pages have a source-directory link.

Prefer upstream Deno support or supported generator hooks for these fixes.
Investigate declaration-based input without losing module prose or stable
source mapping. Avoid mass JSDoc rewrites or a custom documentation renderer.

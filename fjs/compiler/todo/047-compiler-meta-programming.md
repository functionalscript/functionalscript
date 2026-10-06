## 47. The compiler should be able to load and run modules as meta-programming.

**Priority:** P3
**Status:** open

The compiler already supports
[module interpretation](../../edag/values.md#module-initialization) through
`compiler/transpiler.interpret`: it resolves imports and runs initializers into
closed export value graphs. An unresolved initializer remains code. Failed
initialization reports the source path and retains the language-thrown value.

New source-language metaprogramming APIs remain separate proposals requiring
language-design approval; this value representation does not select those APIs.

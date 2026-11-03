# Vertical-tab escapes in templates

Admit `\v` in untagged template chunks as U+000B, equivalent to `\u000b` and matching the existing single-quoted escape. Reuse the shared JavaScript lexer and decoder; change only compiler admission. This removes a dependency-scan failure without new AST or FAST nodes. Double-quoted admission, raw C0 controls, NUL shorthand, identity escapes and line continuations stay unchanged. Delimiter-specific escape sets remain a drawback documented in the specification.

Designer sergey-shandar approved this increment in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).

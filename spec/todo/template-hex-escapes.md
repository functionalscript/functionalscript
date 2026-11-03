# Template hexadecimal escapes

Admit `\xHH` in untagged templates, matching existing single-quoted strings. Reuse the shared lexer's exact two-hex-digit validation and cooked UTF-16 code unit; widen only the compiler template spelling policy. This removes dependency-scan failures without new AST or FAST nodes. Keep malformed hex, NUL shorthand, vertical-tab and identity escapes refused; double-quoted string admission is unchanged. Delimiter-specific escape sets remain a drawback, documented explicitly.

Designer sergey-shandar approved this increment in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).

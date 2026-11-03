# Unreachable Statements

**Status:** implemented

Syntax AST preserves statements after a return, throw or terminal control-flow
statement. Name, declaration and capture checks still apply to all written
statements. FAST normalization discards computations that cannot execute.

See [bodies and guards](../../control-flow/guards/README.md) for the completion contract
and language-design approval.

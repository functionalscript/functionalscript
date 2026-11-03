# Module dependency checks

```sh
fjs deps
```

The command writes `_deps.json` in the caller's directory, replacing an existing
file only after the scan succeeds. No arguments are accepted. Under npm,
`INIT_CWD` selects the caller's original directory.

The JSON object maps each module path to an array of its direct dependency
paths. Each module appears once, modules without dependencies have empty arrays,
and repeated imports produce one edge. Paths are relative to the output
directory, with `/` separators and `../` for dependencies outside it. A dependency on another filesystem root (such as
a different Windows drive) keeps its absolute path.
Cycles are recorded; compilation still rejects them.

Entry points are all files ending in `.f.js` or `.f.mjs`, including proofs,
demos, helpers and standalone samples, discovered recursively under the caller's directory. Hidden entries, `node_modules` and
`target` are skipped during discovery. Imports are followed transitively,
including helpers and modules outside the scanned subtree. JSON imports are
leaves with empty dependency arrays.

The parser does not yet accept every authored source. Expanding a scan to proofs
can expose unsupported syntax in existing files; each diagnostic names the first
unsupported construct in that file. The scan fails instead of publishing an
incomplete dependency graph.

Source files are read as UTF-8 without importing or executing them. Dependency
extraction reads the syntax AST's import declarations through the compiler's
shared import-attribute reader and filesystem resolver. It does not validate
selected exports or source bindings, apply FunctionalScript admission, or lower
to FAST or EDAG. JSDoc type imports are not runtime dependencies.

Function bodies may end normally without an explicit `return undefined` at the
syntax-AST level. The AST preserves an implicit-return marker; compilation still
requires an admitted terminal form.

Its syntax AST can represent forms that FJS compilation still refuses,
including braced `for (const item of items)` and `for (let item of items)`
declaration loops. Recognizing that syntax does not select iteration semantics.
Constructor expressions such as `new Map(entries)` and `new Set(values)`
also form syntax ASTs, retaining their constructor, arguments and source token.
The argument parentheses are required in this increment. Constructor support
here defines no FunctionalScript constructor semantics or lowering; compilation
still explicitly refuses construction at `new`.
Number literal object keys such as `{ 0x70: value }` also form syntax ASTs.
Their FunctionalScript admission reuses the existing computed-key lowering;
the dependency check still performs only syntax parsing.
Named `let` declarations can omit their initializer. The syntax AST preserves
that absence; compilation separately supplies primitive `undefined` at the
declaration point. `const` and destructuring declarations require initializers.
Each read, resolution or syntax failure is reported with its source location
when known; the remaining entry points are still checked. The summary counts
module visits, including JSON leaves, with valid cached repeats omitted. Any failed file, discovery error
or output-write failure exits with code 1. A failed scan leaves an existing
`_deps.json` untouched. Successful scans, including an empty tree, exit with
code 0; an empty tree writes `{}` followed by a newline.

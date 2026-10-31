# Module dependency checks

```sh
fjs deps
```

The command recursively discovers files named exactly `module.f.js` or
`module.f.mjs` under the caller's directory and checks that each file can form
a syntax AST. This initial selection prepares coverage checks for those modules.
Under npm, the caller's original directory (`INIT_CWD`) selects the subtree.
Discovery uses the same rules as the other source checks: hidden entries,
`node_modules` and `target` are skipped.

This initial command uses the current compiler tokenizer and syntax AST parser
to report their unsupported source forms. Parser extensions are a later step.

Source files are read as UTF-8 without importing or executing them. The check
does not resolve imports or source bindings, apply FunctionalScript admission,
or lower to FAST or EDAG.
Each read or syntax failure is reported with its source location when known;
the remaining files are still checked. A summary reports parsed, failed and
total files. Any failed file or discovery error exits with code 1; a successful
scan, including an empty source tree, exits with code 0.

Only the no-argument form is implemented. Dependency extraction and `.data.js`
graph output are later tasks in the
[dependency graph command TODO](../todo/module-dependency-graph-command.md).

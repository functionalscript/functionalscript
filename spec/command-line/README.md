# Command Line

**Status:** implemented

```sh
fjs compile <input> <output>
fjs compile
```

`fjs compile` reads the input and resolves every module it imports into one
program. The value outputs, `.json` and `.data.js`, evaluate that program and
write the exported value; the graph outputs — FunctionalScript, EDAG and
Rust — write the program itself and evaluate nothing ([output](output.md)). So a
module whose evaluation fails, such as `const c = null.x; export default 1;`
or one that imports it, compiles to no value output — the error is
`module initialization failed`, naming the failing module — while a graph
output never sees the failure: it writes the program, which fails when it runs, as the module does
in JavaScript.

Both file names are part of the command: the **input extension names the
input language** and the **output extension names the output format**.

The point is that configuration data can move between the two languages
without a bespoke tool at either end. A legacy configuration can be read as
JSON and converted to `.f.js`, where it gains comments, shared constants, and
imports; and a `.f.js` configuration can be compiled back to `.json` for a
consumer that speaks only JSON.

```sh
fjs compile legacy.json config.f.js    # adopt a legacy configuration
fjs compile config.f.js  config.json   # produce JSON for a JSON-only consumer
fjs compile config.f.js  bundle.f.js   # inline every import into one module
```

The two file names are filesystem paths, taken literally rather than as
import specifiers, so `%41`, `?` and `#` are ordinary characters in them. An
extension is matched exactly, case included: `out.JSON` names no output format
and is refused, `out.Data.js` is a FunctionalScript name rather than a DataJS
one, and an `in.JSON` input is read by the module parser. The command takes
these two names, or none ([the check](checking.md)); any other count
fails, naming no file: one with `Error: Requires 2 arguments`, and more than
two with the first one it does not read, `Error: unexpected argument --tree`,
rather than succeed without it.

On success the command creates the output's parent directories recursively,
writes the output and exits `0`. On failure it writes
nothing, reports the error on `stderr`, and exits `1`:

```text
/project/config.f.js:3:18 - error: __proto__ requires the computed key form
```

An error names the file it belongs to, which is the input only when the
failure is there. A failure of the program names the module it happens in —
the input or any module it imports — by the path the host loaded it from,
which on Node is absolute with symlinks resolved. An import that cannot be
resolved names the module importing it; one whose module lacks the selected
export, or is not what its import attribute declares, names that module; and
a circular dependency names the module met again. Only an input that cannot
be resolved at all keeps the spelling given on the command line. A value
output reports an initialization failure as `module initialization failed`.
The interpreter retains the evaluated thrown payload for API consumers;
the CLI diagnostic does not expose it as a language-level observation.
A refusal of the output names the output as given instead,
since the module itself is sound: an extension naming no format, a value JSON
cannot spell, a callable in the selected data, or a node the FunctionalScript
or Rust writer has no spelling for. A failure to create a directory or write
the output — a parent that is a file, a name that is a directory — is reported
in the host's own words, which name the affected path too:
`EISDIR: illegal operation on a directory, open 'out/config.json'`.

A parse error carries the token's `path:line:column`, as above. A lexical
error — a character no token begins with, a string or block comment the input
ends inside, or one holding a character or escape it may not — carries a span
instead, from where its token began to where the input ends:
`path:line:column-column` within one line and `path:line:column-line:column`
across lines. A file holding only `export default @;` is reported at
`/project/bad.f.js:1:16-18`, or at `1:16-2:1` when a newline ends it. A
malformed number points at the character that spoils it: `08` at its `8`.
Lines and columns count from 1, and a column counts UTF-16 code units, so a
tab is one and a character beyond U+FFFF two. A line ends where JavaScript
ends one: at a newline ([whitespace](../lexical/whitespace/README.md)), and
at a U+2028 or U+2029 inside a string. A CRLF ends one line, not two.

The JSON reader tracks no lines. A malformed `.json` document, the input or an
import, gives in its message the UTF-16 code-unit offset reading failed at,
counted from 0 — `/project/e.json - error: unexpected symbol at 19` — or
`unexpected end` when the text runs out
([parse-error-location-format](../../fjs/media/json/todo/parse-error-location-format.md)).

`fjs compile` is one of several `fjs` commands; see
[`fjs/README.md`](../../fjs/README.md) for the rest.

## Pages

- [Checking Every `.f.js`](./checking.md)
- [Source Text](./source-text.md)
- [File Types](./file-types.md)
- [JSON Input](./json-input.md)
- [Output](./output.md)

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: none; this is FunctionalScript's own tool, not a feature of the language.

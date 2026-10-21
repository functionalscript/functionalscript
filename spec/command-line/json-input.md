# JSON Input

**Status:** implemented

A `.json` input is a JSON document, read by the JSON reader. Anything else is
a FunctionalScript module, read by the module parser. An imported `.json`
file is a JSON document too, and its import says so with `with { type: "json" }`
([importing](../modules/imports.md)).

```json
{
    "a": null,
    "b": [-42.5, false, "hello"]
}
```

A JSON document is **not** a FunctionalScript module. A module is a sequence
of statements, and no statement begins with a value: as JavaScript, `{"a":1}`
does not parse at all and `[1,2]` is an expression statement that exports
nothing. Reading such a text as a module would give it a meaning no JavaScript
engine gives it, against principle 2.

What the two languages share is *values*, not texts. Every JSON value is a
FunctionalScript value, so a JSON document compiles into a module denoting the
same value — with one key spelled differently on the way
([`__proto__`](../values/objects/README.md#the-__proto__-key)).

Two readers also means a `.json` file is JSON and nothing more. Comments,
`bigint`, `undefined`, identifier keys, computed keys, and trailing commas
belong to the module language, and a `.json` input using any of them is an
error.

The extension is a declaration, not a guess about the content. JavaScript
decides the same way: `import` takes a module's type from the extension — or,
in a browser, from the response MIME type — together with an import attribute
(`with { type: "json" }`), and never from the text. A `.js` file holding JSON
is JavaScript there, and stating `type: "json"` for it is an error rather than
a reinterpretation.

For the root, the declaration is the name on the command line. The root is
resolved to its real file as an import is, symlinks followed
([host profile](../modules/imports.md)), and a root named `.json` is read
by the JSON reader whatever the file it resolves to is called. A root with any
other name that resolves to a file named `.json` is refused, the way an import
of that file without `with { type: "json" }` is (`a JSON module needs the
import attribute with { type: "json" }`), since the command line has no
attribute to state that type with.

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: none; this is FunctionalScript's own tool, not a feature of the language.

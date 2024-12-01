# FunctionalScript Language

## File Types

|File Type|Extension        |Notes       |
|---------|-----------------|------------|
|JSON     |`.json`          |Not a graph.|
|DJS      |`.d.js`, `.d.mjs`|A graph.    |
|FJS      |`.f.js`, `.f.mjs`|Functions.  |

**Note**: An FJS value can't be serialized without additional run-time infrastructure.

## JSON

JSON forms a tree of values.

```json
{
    "a": null,
    "b": [-42.5, false, "hello"]
}
```

File extension: `.json`.

## DJS

The DJS form a graph of values. It can be serialized without additional run-time information.

File extensions: `.d.js` and `.d.mjs`.

- [ ] [export-default](export-default.md)
- [ ] [const](const.md)
- [ ] [import](import.md)

- [ ] [line-comment](line-comment.md)
- [ ] [block-comment](block-comment.md)
- [ ] [identifier-property](identifier-property)
- [ ] [shorthand](shorthand.md)
- [ ] [destructuring](destructuring.md)

## FJS

The FJS can have functions. The format requires additional run-time information for serialization.

File extensions: `.f.js` and `.f.mjs`.

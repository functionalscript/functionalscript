# Path

## Simplified Common.js

A path should be disambiguous.

Path limitations:

- Accepted file extensions: `.f.js`, `.json`.
- A file path should be fully specified.  For example `../package/dependencies/test.f.js`.
- A package name can't contain `/`. For example 
  - `functionalscript/main.f.js` is allowed.
  - `functionalscript/functionalscript/main.f.js` is not allowed.

`package.json` limitations:

- Only GitHub packages can be referenced. In the future, we may add generic Git repositories.

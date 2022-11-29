# Common.js

## Package

[package/main.f.js](package/main.f.js)

```ts
// A dictionary of packages.
//
// A package contains a dictionary of dependencies and a dictionary of files.
//
// `packageId` examples:
//   - Node.js:
//     - normalized: `./node_modules/functionalscript`
//   - fs modules:
//     - normalized: `github:functionalscript/functionalscript:bf4f3ed9ad1d3c19ee7bea3e76000dec77d01b4f`
// - `localPackageId` examples:
//   - `functionalscript`

type PackageGet = (packageId: string) => Package | null

// A local file id is

type Package = {
    // returns a global package id.
    readonly dependency: (localPackageId: string) => string | null
    // returns source of the file.
    readonly file: (localFileId: string) => string | null
}
```

## Module

[module/main.f.js](module/main.f.js)

```ts
// A module map is a dictionary of modules.
//
// A module is a compiled and initialized source file.

type ModuleGet = (moduleId: string) => ModuleState | null

type ModuleMapInterface<M> = {
    readonly get: (moduleMap: M) => ModuleGet
    readonly insert: (moduleMap: M) => (moduleId: string) => (moduleState: ModuleState) => M
}

type ModuleState = readonly['ok', Module] | readonly['error', ModuleError]

type Module = {
    // Exports is a result of module initialization.
    readonly exports: unknown
    // A dictionary of required modules.
    // For example, `require('functionalscript/types/list')` may produce the dictionary entry
    // `['functionalscript/types/list', './node_modules/functionalscript/types/list/index.js']`
    readonly requireMap: object.Map<string>
}

type ModuleError = 'file not found' | 'compile error' | 'runtime error' | 'circular reference'

// A module id is a global module id. It contains a package id and file id. For example
// - `./node_modules/functionalscript/types/list/index.js`
// - `github:functionalscript/functionalscript:bf4f3ed9ad1d3c19ee7bea3e76000dec77d01b4f/types/list/index.js`

type ModuleId = {
    readonly packageId: string,
    readonly path: readonly string[],
}

const moduleIdToString: (moduleId: ModuleId) => string;
```

## Build

[build/index.js](build/index.js)

```ts
type BuildConfig<M> = {
    readonly packageGet: PackageGet
    readonly moduleMapInterface: ModuleMapInterface<M>
    readonly moduleId: ModuleId
    readonly moduleMap: M // mutable
}

type BuildState<M> = {
    readonly packageGet: PackageGet
    readonly moduleMapInterface: ModuleMapInterface<M>
    readonly moduleId: ModuleId
    readonly moduleMap: M // mutable
    readonly ModuleRequireMap: map.Map<string> // mutable
}

const getOrBuild: <M>(buildConfig: BuildConfig<M>) => readonly[ModuleState, M];
```

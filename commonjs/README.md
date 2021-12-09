# Common.js

```ts
// package/index.js

type PackageGet = (packageId: string) => Package | undefined
type Package = {
    // returns a global package id.
    readonly dependency: (localPackageId: string) => string | undefined
    // returns source of the file.
    readonly file: (localFileId: string) => string | undefined
}

// module/index.js

type ModuleMapInterface<M> = {
    readonly at: (moduleId: string) => (moduleMap: M) => ModuleState | undefined
    readonly insert: (moduleId: string) => (moduleState: ModuleState) => (moduleMap: M) => M
}

type ModuleState = readonly['ok', Module] | readonly['error', ModuleError] | readonly['building']

type Module = {
    readonly exports: unknown
    readonly requireMap: object.Map<string>
}

type ModuleError = 'file not found' | 'compile error' | 'runtime error' | 'circular reference'

type ModuleId = { 
    readonly packageId: string,
    readonly path: readonly string[],
}

const moduleIdToString: (moduleId: ModuleId) => string;

// build/index.js

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

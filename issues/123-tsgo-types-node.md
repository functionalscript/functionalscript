# 123. `tsgo` asks for `"types": ["node"]` in tsconfig.

`tsgo` asks for `"types": ["node"]` in the [../tsconfig.json](../tsconfig.json). It looks like a regression to me because we've installed `@types/node` as `devDependencies`.

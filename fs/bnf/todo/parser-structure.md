## Parser Structure

**Priority:** P3
**Status:** open

1. AST, the structure can contain function structures.
   - 1. w/o imports.
     ```ts
     type Ast = ...
     const parseSync: (ioContext: IoContext) => (fileName: string) => Ast = ...
     // used by `toString(f)`.
     const astToSourceCode: (ast: Ast) => string = ...
     // the AST is the stable serializable representation of functions;
     // see `todo/lang/README.md` §9. Bytecode is VM-internal only.
     // The result is the CBOR byte stream as a `Vec` (`fs/types/bit_vec`),
     // which preserves the exact byte length via its stop bit.
     const serializeAst: (ast: Ast) => Vec = ...
     ```
   - 2. with imports. A temporary structure. Module resolver with I/O can convert AST with imports into AST without imports.
     ```ts
     type ModuleAst = ...
     const parseModule: (s: string) => ModuleAst = ...
     ```
2. JS value.
   - any JS value w/o functions can be converted to AST w/o imports.
     ```ts
     type JsonPrimitive = number | boolean | string | null
     type Json = { readonly[k in string]: Json } | readonly Json[] | JsonPrimitive
     type DjsPrimitive = JsonPrimitive | undefined | bigint
     type Djs = { readonly[k in string]: Djs } | readonly Djs[] | DjsPrimitive
     const toAst: (djs: Djs) => Ast = ...
     const astToDjs: (ast: Ast) => Result<Djs> = ...
     const djsToJson: (djs: Djs) => Result<Json> = ...
     ```
   - any AST w/o imports can be converted to JS value
     ```ts
     const Fjs = { readonly[k in string]: Fjs } | readonly Fjs[] | DjsPrimitive | (...a: readonly Fjs) => Fjs
     const astToFjs: (toFunc: (s: string) => Function) => (ast: Ast) => Fjs = ...
     const fjsToAst: (magicFunction: (f: Function) => string) => (fjs: Fjs) => Ast = ...
     ```

/**
 * The runtime as the generators and the harness need it: where
 * [`fjs/js/runtime`](../../js/runtime/module.f.js) is authored, where
 * `npm run gen` compiles it to — Rust for `nanvm-lib`, EDAG for the corpus
 * proof — and the runtime loaded from its source, for the fixture
 * expectations [`../harness`](../harness/module.f.mjs) interprets under it.
 *
 * The compiles go through [`compileFile`](../../compiler/module.f.mjs), the
 * compiler being the generator; and the load through the same interpreter
 * the harness runs its fixtures on, with no runtime of its own, since the
 * runtime's initialization calls no member function.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 * @import { Runtime } from '../../edag/value/types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { ioError, pureError, pureOk, resultStep, step } from '../../effects/module.f.mjs'
import { compileFile } from '../../compiler/module.f.mjs'
import { interpret } from '../../compiler/transpiler/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'

/** Where the runtime is authored. */
export const source = 'fjs/js/runtime/module.f.js'

/**
 * Where its Rust goes: beside the binder `vm/runtime.rs`, which includes
 * it by `#[path]`, since a `gen.` name is not a Rust identifier.
 */
export const rustPath = 'nanvm/lib/src/vm/gen.runtime.rs'

/**
 * Where its EDAG goes, beside its source, for the corpus proof
 * [`../proof.f.mjs`](../proof.f.mjs): the one consumer that needs the
 * runtime as data without the compiler. Nothing the compiler imports reads
 * it — `npm run gen` deletes every `gen.*` first, and a generator whose own
 * imports needed one could not start.
 */
export const edagPath = 'fjs/js/runtime/gen.edag.data.mjs'

/** Compiles the runtime to Rust, then to EDAG. @type {() => Effect<_CompileOp, void, IoChannel>} */
export const generate = () => step(compileFile(source, rustPath), () => compileFile(source, edagPath))

/**
 * The runtime interpreted from its source: its `runtime` export, as an
 * executor takes it. A source the interpreter cannot load, or one exporting
 * no `runtime` object, is the failure of whatever generator asked for it.
 *
 * @type {() => Effect<ReadWhole | ResolveFileModule, Runtime, IoChannel>}
 */
export const load = () => resultStep(interpret(source), result => {
    const [kind, value] = result
    if (kind === 'error') { return pureError(ioError({ message: `${source}: ${value.message}` })) }
    const [exportKind, runtime] = read(ok(value), 'runtime')
    return exportKind === 'ok' && isArray(runtime) && runtime[0] === '{}'
        ? pureOk(runtime)
        : pureError(ioError({ message: `${source}: no runtime export` }))
})

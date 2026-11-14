/**
 * The runtime as the generators and the harness need it: where
 * [`fjs/js/runtime`](../../js/runtime/module.f.js) is authored, where
 * `npm run gen` compiles it to — Rust for `nanvm-lib`, EDAG for the corpus
 * proof — and the runtime loaded from its source, for the fixture
 * expectations [`../harness`](../harness/module.f.mjs) interprets under it.
 *
 * The source is resolved once by the compiler, then written as Rust and
 * an ordinary JavaScript module holding EDAG data. The latter exports an
 * explicit unknown boundary so TypeScript need not expand the graph's
 * shared subgraphs into a declaration. The load goes through `runtimeAt`,
 * which the compile command uses too, with the repository root as the
 * package the generators run from.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 * @import { Runtime } from '../../edag/value/types.ts'
 */

import { ioError, pureError, pureOk, resultStep } from '../../effects/module.f.js'
import { writeFiles } from '../../effects/node/module.f.js'
import { runtimeSource } from '../../compiler/module.f.mjs'
import { runtimeAt } from '../../compiler/transpiler/module.f.mjs'
import { resolve } from '../../compiler/edag/module.f.mjs'
import { generateRuntime } from '../../compiler/rust/runtime/module.f.mjs'
import { _tryUnknownStringify } from '../../media/datajs/serializer/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'

/** Where the runtime is authored, from the repository root the generators run from. */
export const source = runtimeSource('.')

/**
 * Where its Rust goes: beside the binder `vm/runtime.rs`, which includes
 * it by `#[path]`, since a `gen.` name is not a Rust identifier.
 */
export const rustPath = 'nanvm/lib/src/vm/gen.runtime.rs'

/**
 * Where its EDAG goes as ordinary JavaScript, beside its source, for the corpus proof
 * [`../proof.f.mjs`](../proof.f.mjs) and the compiler's demo: the consumers
 * that need the runtime as data without a file system. Nothing the compiler
 * imports reads it — `npm run gen` deletes every `gen.*` first, and a
 * generator whose own imports needed one could not start.
 */
export const edagPath = 'fjs/js/runtime/gen.edag.js'

/**
 * The numerical kernel's notice must survive compilation into distributed Rust source.
 * @type {string}
 */
const numericalNotice = `/*
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 */
`

/**
 * The runtime linked into one graph and written as Rust and typed JavaScript
 * data. A resolved EDAG is a valid acyclic data graph by construction, so a
 * serializer refusal would violate the compiler's invariant. A source the
 * linker refuses or a module the Rust printer refuses remains a diagnostic.
 *
 * @type {() => Effect<_CompileOp, void, IoChannel>}
 */
export const generate = () => resultStep(resolve(source), result => {
    const [kind, value] = result
    if (kind === 'error') { return pureError(ioError({ message: `${source}: ${value.message}` })) }
    const [tag, rust] = generateRuntime(value)
    return tag === 'error' ? pureError(ioError({ message: `${rustPath}: ${rust}` })) : writeFiles([
        [rustPath, `${rust}\n${numericalNotice}`],
        [edagPath, `${numericalNotice}${unwrap(_tryUnknownStringify(value))}\n`],
    ])
})

/**
 * The runtime interpreted from its source: its `runtime` export, as an
 * executor takes it. A source the interpreter cannot load, or one exporting
 * no `runtime` object, is the failure of whatever generator asked for it.
 *
 * @type {() => Effect<ReadWhole | ResolveFileModule, Runtime, IoChannel>}
 */
export const load = () => resultStep(runtimeAt(source), result => {
    const [kind, value] = result
    return kind === 'ok' ? pureOk(value) : pureError(ioError({ message: `${value.path}: ${value.message}` }))
})

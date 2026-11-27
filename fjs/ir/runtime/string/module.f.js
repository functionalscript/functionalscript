/**
 * String runtime-module for short strings in the IR
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md)):
 * one logical interface, three interchangeable manifests (A / B / C), short
 * pack/unpack helpers (in `short.f.js`), and the B IR module that
 * `linkString` merges for length/unit (S3). Programs call String ops; they
 * never import the helpers.
 *
 * @module
 *
 * @import { Manifest } from './types.ts'
 */

import { emitA, emitB } from './short.f.js'

/**
 * Logical ops every String variant must expose to programs / emitters.
 * `unit` is L0's name; the modular-runtime memo spells the same op `at`.
 */
export const ops = /** @type {const} */ (['unpack', 'length', 'unit'])

/** Import-form spelling of `unit` as `at` (one function until the owner picks). */
export const atAlias = 'at'

/**
 * A — host-backed baseline: every string stays a dyn-ref; zero slots;
 * `unpack` null; length/unit are L0 imports; emit always dyn-ref.
 *
 * @type {Manifest}
 */
export const a = {
    id: 'A',
    moduleName: 'fjs:l0/string',
    version: '1',
    requiresAny: 'any',
    slots: [],
    unpack: { kind: 'null' },
    length: { kind: 'import', op: 'length' },
    unit: { kind: 'import', op: 'unit' },
    emit: emitA,
    longPath: 'fjs:l0',
}

/**
 * B — NaN memory-saving: zero slots; `unpack` null; length/unit re-decode
 * the box (helpers in `short.f.js`); short emit when a v1-enabled tag fits.
 *
 * @type {Manifest}
 */
export const b = {
    id: 'B',
    moduleName: 'fjs:ir/string/memory',
    version: '1',
    requiresAny: 'nan',
    slots: [],
    unpack: { kind: 'null' },
    length: { kind: 'template', op: 'length' },
    unit: { kind: 'template', op: 'unit' },
    emit: emitB,
    longPath: 'fjs:l0',
}

/**
 * C — NaN CPU-saving: provisional **C-flag** layout (design open Q2):
 * flag + length + eight unit/handle slots. `unpack` is a template; length
 * and unit read slots. Same v1 enabled tags and emit policy as B.
 *
 * @type {Manifest}
 */
export const c = {
    id: 'C',
    moduleName: 'fjs:ir/string/cpu',
    version: '1',
    requiresAny: 'nan',
    // flag, length, then eight unit (or long-handle) locals — all i32.
    slots: ['i32', 'i32', 'i32', 'i32', 'i32', 'i32', 'i32', 'i32', 'i32', 'i32'],
    unpack: { kind: 'template', op: 'unpack' },
    length: { kind: 'template', op: 'length' },
    unit: { kind: 'template', op: 'unit' },
    emit: emitB,
    longPath: 'fjs:l0',
    layout: 'C-flag',
}

/** The three interchangeable variants, in experiment order A then B then C. */
export const variants = /** @type {const} */ ([a, b, c])

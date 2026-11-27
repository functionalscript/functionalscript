/**
 * String runtime-module manifests and short-string tag names
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md) S1).
 *
 * @module
 */

/** Sergey's scalar short-string encodings. */
export type ShortTag =
    | 'empty'
    | 's1x16'
    | 's2x16'
    | 's3x16'
    | 's4x7'
    | 's5x7'
    | 's6x7'
    | 's7x7'
    | 's8x6'

/** WASM local type a template-form `str` layout may claim. */
export type SlotType = 'i32' | 'i64' | 'f64'

/**
 * How one logical String op is supplied: an L0 import, an inlined
 * template, or a no-op (`null`, e.g. memory-saving `unpack`).
 * `op` is the import or template member name (`name` is a prohibited
 * property read in FunctionalScript).
 */
export type FunctionForm =
    | { readonly kind: 'import', readonly op: string }
    | { readonly kind: 'template', readonly op: string }
    | { readonly kind: 'null' }

/**
 * Whether allocating string imports on a counting / NaNVM host may return
 * a short-string box ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md)
 * S2 / S4 decision gate). Prefer named policies `emitA` / `emitB` from
 * `short.f.js`: A is always dyn-ref (counting default); B is short when a
 * v1-enabled tag fits (NaNVM default). A miss or a disabled tag is forced
 * long, never refused.
 */
export type StringEmit =
    | { readonly kind: 'alwaysDynRef' }
    | { readonly kind: 'shortWhenEnabled', readonly enabledTags: readonly ShortTag[] }

/**
 * One String runtime-module variant: the interface programs see is fixed;
 * only this configuration swaps (design experiment plan).
 */
export type Manifest = {
    readonly id: 'A' | 'B' | 'C'
    readonly moduleName: string
    readonly version: string
    /** Encoding Any must supply; A accepts either. */
    readonly requiresAny: 'any' | 'nan'
    readonly slots: readonly SlotType[]
    readonly unpack: FunctionForm
    readonly length: FunctionForm
    /** L0 name `unit`; modular-runtime memo spelling `at` — one op. */
    readonly unit: FunctionForm
    /** The host's emit policy for this variant, with its enabled tags. */
    readonly emit: StringEmit
    /** Long-string import path when the short arm does not apply. */
    readonly longPath: string
    /** C-flag vs C-sentinel; only meaningful for variant C (open Q2). */
    readonly layout?: 'C-flag' | 'C-sentinel'
}

/**
 * The WAT writer's own types.
 *
 * @module
 */

import type { Module } from '../types.ts'

/**
 * How an item is named: as itself, quoted where it holds a character no
 * identifier may, or under a `#` prefix that makes it unique.
 */
export type _Naming =
    | { readonly name: string, readonly prefix: null, readonly quoted: boolean }
    | { readonly name: string, readonly prefix: string }

/** The namings the name section gives, by kind and index. */
export type _Names = {
    readonly module: _Naming | null
    readonly func: ReadonlyMap<number, _Naming>
    readonly type: ReadonlyMap<number, _Naming>
    readonly table: ReadonlyMap<number, _Naming>
    readonly memory: ReadonlyMap<number, _Naming>
    readonly global: ReadonlyMap<number, _Naming>
    readonly elem: ReadonlyMap<number, _Naming>
    readonly data: ReadonlyMap<number, _Naming>
    /** Each function's parameters and locals, by function index. */
    readonly local: ReadonlyMap<number, ReadonlyMap<number, _Naming>>
}

/**
 * What an instruction is printed against: the module, its names, the
 * namings of the current function's parameters and locals, and how many
 * blocks are open around it.
 */
export type _Context = {
    readonly module: Module
    readonly names: _Names
    readonly locals: ReadonlyMap<number, _Naming>
    readonly depth: number
}

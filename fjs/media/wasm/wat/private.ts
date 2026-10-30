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
export type Naming =
    | { readonly name: string, readonly prefix: null, readonly quoted: boolean }
    | { readonly name: string, readonly prefix: string }

/** The namings the name section gives, by kind and index. */
export type Names = {
    readonly module: Naming | null
    readonly func: ReadonlyMap<number, Naming>
    readonly type: ReadonlyMap<number, Naming>
    readonly table: ReadonlyMap<number, Naming>
    readonly memory: ReadonlyMap<number, Naming>
    readonly global: ReadonlyMap<number, Naming>
    readonly elem: ReadonlyMap<number, Naming>
    readonly data: ReadonlyMap<number, Naming>
    /** Each function's parameters and locals, by function index. */
    readonly local: ReadonlyMap<number, ReadonlyMap<number, Naming>>
}

/**
 * What an instruction is printed against: the module, its names, the
 * namings of the current function's parameters and locals, and how many
 * blocks are open around it.
 */
export type Context = {
    readonly module: Module
    readonly names: Names
    readonly locals: ReadonlyMap<number, Naming>
    readonly depth: number
}

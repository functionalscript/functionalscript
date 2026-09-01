/**
 * Comparison function types.
 *
 * @module
 */

export type Sign = -1 | 0 | 1

export type Compare<T> = (_: T) => Sign

export type Cmp<T> = (a: T) => Compare<T>

export type Cmp1 = boolean | string | number | bigint

export type Cmp2<A, B> =
    readonly [A, B] extends readonly [boolean, boolean] ? boolean :
    readonly [A, B] extends readonly [string, string] ? string :
    readonly [A, B] extends readonly [number, number] ? number :
    readonly [A, B] extends readonly [bigint, bigint] ? bigint :
    never

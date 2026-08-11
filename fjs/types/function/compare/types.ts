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
    [A, B] extends [boolean, boolean] ? boolean :
    [A, B] extends [string, string] ? string :
    [A, B] extends [number, number] ? number :
    [A, B] extends [bigint, bigint] ? bigint :
    never

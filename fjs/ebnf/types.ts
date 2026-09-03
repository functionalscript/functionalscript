export type DataRule =
    | number
    | string
    | Tuple
    | Variant

export type Tuple =
    readonly Rule[]

/** The type is the same as AbstractRequiredMap. */
export type Variant =
    { readonly[k in string]: Rule }

export type Rule =
    | DataRule
    | Thunk

export type Thunk =
    | ConstInfo
    | RangeInfo
    | RepeatInfo

export type Info<T extends readonly[string, ...readonly unknown[]]> =
    () => T

export type ConstInfo =
    Info<['const', DataRule]>

export type RangeInfo =
    Info<['range', number, number]>

export type RepeatInfo =
    Info<['repeat', number, number, Rule]>

export type Infinity = typeof Infinity

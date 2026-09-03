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
    | ConstInfo<DataRule>
    | SetInfo<readonly number[]>
    | Info<['repeat', number, number, Rule]>

export type Info<T extends readonly[string, ...readonly unknown[]]> =
    () => T

export type ConstInfo<R extends DataRule> =
    Info<['const', R]>

export type SetInfo<S extends readonly number[]> =
    Info<['set', ...S]>

export type RepeatInfo<Min extends number, Max extends number, R extends Rule> =
    Info<['repeat', Min, Max, R]>

export type Infinity =
    typeof Infinity

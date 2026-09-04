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
    | SetInfo
    | Info<readonly['repeat', number, number, Rule]>

export type Info<T extends readonly[string, ...readonly unknown[]]> =
    () => T

export type ConstInfo<R extends DataRule> =
    Info<readonly['const', R]>

export type SetInfo =
    Info<readonly['set', ...readonly number[]]>

export type RepeatInfo<Min extends number, Max extends number, R extends Rule> =
    Info<readonly['repeat', Min, Max, R]>

export type Infinity =
    typeof Infinity

export type DataRule =
    | number
    | string
    | Tuple
    | Variant

export type Tuple =
    readonly Rule[]

/**
 * The type is the same as AbstractRequiredMap,
 * but we can't use it because of circular dependencies.
 */
export type Variant =
    { readonly[k in string]: Rule }

export type Rule =
    | DataRule
    | Thunk

export type Thunk =
    | Const<DataRule>
    | Set
    // The same as Repeat<number, number, Rule>
    // but we can't use it because of circular dependencies.
    | Info<readonly['repeat', number, number, Rule]>

export type Info<T extends readonly[string, ...readonly unknown[]]> =
    () => T

export type Const<R extends DataRule> =
    Info<readonly['const', R]>

export type Set =
    Info<readonly['set', ...readonly number[]]>

export type Repeat<Min extends number, Max extends number, R extends Rule> =
    Info<readonly['repeat', Min, Max, R]>

export type Infinity =
    typeof Infinity

export type RepeatFrom<Min extends number, R extends Rule> =
    Repeat<Min, Infinity, R>

export type Times<N extends number, R extends Rule> =
    Repeat<N, N, R>

export type Option<R extends Rule> =
    Repeat<0, 1, R>

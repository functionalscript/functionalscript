type Lazy<T> = () => T

type Index = string|number

type Args = readonly unknown[]

type PropertyLambda = {
    readonly end: () => unknown
    // `()`
    readonly call: (args: Lazy<Args>) => unknown
    // `?.()`
    readonly optionCall: (args: Lazy<Args>) => OptionLambda
}

type OptionLambda = {
    readonly end: () => unknown
    // `()`
    readonly call: (args: Lazy<Args>) => OptionLambda
    // `.`
    readonly dot: (index: Lazy<Index>) => OptionPropertyLambda
}

type OptionPropertyLambda = {
    readonly end: () => unknown
    // `?.()`
    readonly optionCall: (args: Lazy<Args>) => unknown
    // `!()`
    readonly endCall: (args: Lazy<Args>) => unknown
}

type Dot = (self: unknown, index: Index) => PropertyLambda

type OptionDot = (self: unknown, index: Lazy<Index>) => OptionPropertyLambda

type OptionCall = (self: unknown, args: Lazy<Args>) => OptionLambda

export const dot: Dot = ...
export const optionDot: OptionDot = ...
export const optionCall: OptionCall = ...

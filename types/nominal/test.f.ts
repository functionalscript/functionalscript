import { asNominal, type Nominal } from "./module.f.ts"

declare const noCompareBrand: unique symbol;

declare const brand: unique symbol;

export default () => {
    type Str = Nominal<'utf8', bigint>
    const strA: Str = asNominal(0b1_11000010_10100010_11000010_10100011n) // "¢£"
    const strB: Str = asNominal(0b1_11000010_10100010_11000010_10100100n) // "¢¤"
    if (strA === strB) { throw [strA, strB] }
    // // TypeScript compilation error.
    // const x1 = strA > strB

    //
    {
        type ForbiddenCompare<T extends object = object> = T & { __noCompare__: never }

        type SafeId = ForbiddenCompare<{ value: number }>

        const a: SafeId = { value: 1 } as SafeId
        const b: SafeId = { value: 2 } as SafeId

        // No Compile-time error
        if (a < b) { }
    }

    {
        interface NoCompare { _brand: 'NoCompare' }

        const x: NoCompare = { _brand: 'NoCompare' }
        // No Error
        if (x < x) { }
    }
    {
        type NoCompare = { [noCompareBrand]: void }

        const a = {} as NoCompare
        const b = {} as NoCompare

        // No Error
        a < b
    }
    {

        type SafeId = symbol & { [brand]: 'SafeId' }

        const a = undefined as any as SafeId
        const b = undefined as any as SafeId

        // a < b; // TS2469: Operator '<' cannot be applied to type 'symbol'.
    }
}

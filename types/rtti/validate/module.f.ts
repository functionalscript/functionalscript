import type { Unknown } from '../../../djs/module.f.ts'
import type { Const, Thunk, Type } from '../module.f.ts'
import type { Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { todo } from '../../../dev/module.f.ts'

export type Result<T extends Type> = CommonResult<Ts<T>, string>

export type Validate<T extends Type> = (value: Unknown) => Result<T>

const thunkValidate = <T extends Thunk>(rtti: T): Validate<T> => {
    const [tag, value] = rtti()
    if (tag === 'const') {
        return constValidate(value) as any
    }
    // Note: Implementation of `array` and `record` shouldn't instantiate `item` RTTI until we get a value.
    //       Otherwise, we can get infinte recursion.
    return todo()
}

const constValidate = <T extends Const>(rtti: T): Validate<T> => todo()

export const validate = <T extends Type>(rtti: T): Validate<T> =>
    typeof rtti === 'function'
        ? thunkValidate(rtti) as any
        : constValidate(rtti) as any

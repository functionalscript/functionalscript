import type { Unknown } from '../../../djs/module.f.ts'
import { isTag1, type Const, type Info1, type Tag1, type Thunk, type Type } from '../module.f.ts'
import { error, ok, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { todo } from '../../../dev/module.f.ts'
import { isArray } from '../../array/module.f.ts'
import { isObject } from '../../object/module.f.ts'

export type Result<T extends Type> = CommonResult<Ts<T>, string>

export type Validate<T extends Type> = (value: Unknown) => Result<T>

// Note: Implementation of `array` and `record` shouldn't instantiate `item` RTTI until we get a value.
//       Otherwise, we can get infinte recursion.

const arrayValidate = <I extends Type>(item: I): Validate<Info1<'array', I>> => value => {
    if (!isArray(value)) {
        return error('array is expected') as any
    }
    if (value.length === 0) {
        return ok(value)
    }
    const itemValidate = validate(item)
    for (const i of value) {
        const r = itemValidate(i)
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value)
}

const recordValidate = <I extends Type>(item: I): Validate<Info1<'record', I>> => value => {
    if (!isObject(value)) {
        return error('object is expects') as any
    }
    const items = Object.values(value)
    if (items.length === 0) {
        return ok(value)
    }
    const itemValidate = validate(item)
    for (const i of items) {
        const r = itemValidate(i)
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value)
}

const tag1Validate = <K extends Tag1, I extends Type, T extends Info1<K, I>>([tag, item]: T): Validate<T> =>
    tag === 'array' ? arrayValidate(item) as any : recordValidate(item) as any

const thunkValidate = <T extends Thunk>(rtti: T): Validate<T> => {
    const info = rtti()
    const [tag, value] = info
    if (tag === 'const') {
        return constValidate(value) as any
    }
    if (isTag1(tag)) {
        return tag1Validate(info as Info1<typeof tag, typeof value>) as any
    }
    return todo()
}

const constValidate = <T extends Const>(rtti: T): Validate<T> => todo()

export const validate = <T extends Type>(rtti: T): Validate<T> =>
    typeof rtti === 'function'
        ? thunkValidate(rtti) as any
        : constValidate(rtti) as any

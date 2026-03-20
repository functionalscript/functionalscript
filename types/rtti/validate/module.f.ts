import type { Unknown } from '../../../djs/module.f.ts'
import type { Type } from '../module.f.ts'
import type { Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { todo } from '../../../dev/module.f.ts'

export type Result<T extends Type> = CommonResult<Ts<T>, string>

export const validate = <T extends Type>(rtti: T) => (value: Unknown): Result<T> => todo()

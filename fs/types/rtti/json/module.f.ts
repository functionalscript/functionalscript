import { boolean, number, or, string, record, array as rttiArray } from '../module.f.ts'

export const primitive = or(null, boolean, number, string)

export const unknown = () => ['or', primitive, object, array] as const

export const object = record(unknown)

export const array = rttiArray(unknown)

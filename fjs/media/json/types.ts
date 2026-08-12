import type { Assert } from "../../asserts/types.ts"
import type { Ts } from "../../types/rtti/ts/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { primitive, unknown } from "./rtti/module.f.mjs"

export type Primitive = Ts<typeof primitive>

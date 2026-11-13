/** Canonical invocation-root transfer reconstruction worklists. @module */

import type { Block, Function as FastFunction, Loop, Value } from '../../../../js/ast/types.ts'

export type _Result = { readonly block: Block; readonly normal: boolean }

export type _Owner = { readonly fn: FastFunction; readonly loop: Loop; readonly self: Value; readonly transported: boolean }

export type _RestResult = { readonly valid: boolean; readonly normal: boolean }

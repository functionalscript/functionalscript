/** Canonical invocation-root transfer reconstruction worklists. @module */

import type { Block, Function as FastFunction, Loop, Value } from '../../../../js/ast/types.ts'

export type _Result = { readonly block: Block; readonly normal: boolean }

export type _Task =
    | { readonly kind: 'done'; readonly value: _Result }
    | { readonly kind: 'call'; readonly run: () => _Task }
    | { readonly kind: 'bind'; readonly first: _Task; readonly next: (value: _Result) => _Task }

export type _Frame = { readonly next: (value: _Result) => _Task; readonly rest: _Frame | null }
export type _Owner = { readonly fn: FastFunction; readonly loop: Loop; readonly self: Value }

/**
 * Type-level API for RTTI deserialization.
 *
 * @module
 */

import type { Type } from '../../../rtti/types.ts'
import type { Result as CommonValidateResult, Validate } from '../../../rtti/common/types.ts'

export type { Path, ValidationError } from '../../../rtti/common/types.ts'

/** Parse result: either the freshly constructed typed value or a `ValidationError`. */
export type Result<T extends Type> = CommonValidateResult<T>

/** A function that parses an unknown value into the schema `T`. */
export type Parse<T extends Type> = Validate<T>

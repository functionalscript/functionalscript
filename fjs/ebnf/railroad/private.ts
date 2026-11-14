/** Implementation-private recursion callback for syntax diagrams. @module */

import type { PersistentSet } from '../../types/set/types.ts'
import type { Diagram } from '../../website/demo/railroad/types.ts'

/** A titled reference, or an untitled rule expanded along the current path. */
export type _Ref = (path: PersistentSet<string>) => (name: string) => Diagram

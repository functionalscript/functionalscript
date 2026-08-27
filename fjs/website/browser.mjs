/** Browser-realm smoke proof for the generated website. */

import { assert } from '../asserts/module.f.mjs'

export const proof = {
    window: () => assert(window.document === document),
    document: () => assert(document.documentElement.localName === 'html'),
}

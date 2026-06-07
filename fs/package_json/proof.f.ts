import { assert } from '../asserts/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import {
    validatePackageJson,
    validatePackageJsonText,
} from './module.f.ts'

export const proof = {
    parseMetadata: () => {
        const result = unwrap(validatePackageJsonText('{"name":"x","version":"1.0.0","scripts":{"test":"node test.js"}}'))
        assert(result.name === 'x', result)
        assert(result.version === '1.0.0', result)
        assert(result.scripts?.test === 'node test.js', result)
    },
    malformedJson: () => {
        const result = validatePackageJsonText('{')
        assert(result[0] === 'error', result)
    },
    validatePreservesOriginalObject: () => {
        const object = { name: 'x', version: '1.0.0', private: true } as const
        const metadata = unwrap(validatePackageJson(object))
        assert(metadata.name === 'x', metadata)
        assert(metadata.version === '1.0.0', metadata)
        assert(Object.is(metadata, object), metadata)
        assert(object.private === true, object)
    },
}

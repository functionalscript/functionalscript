import { assert } from '../asserts/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import {
    parsePackageJsonText,
    validateJsonObjectText,
    validatePackageJson,
    validatePackageJsonWithVersion,
} from './module.f.ts'

export const proof = {
    parseMetadata: () => {
        const result = unwrap(parsePackageJsonText('{"name":"x","version":"1.0.0","scripts":{"test":"node test.js"}}'))
        assert(result.name === 'x', result)
        assert(result.version === '1.0.0', result)
        assert(result.scripts?.test === 'node test.js', result)
    },
    malformedJson: () => {
        const result = parsePackageJsonText('{')
        assert(result[0] === 'error', result)
    },
    validatePreservesOriginalObject: () => {
        const object = unwrap(validateJsonObjectText('{"name":"x","version":"1.0.0","private":true}'))
        const metadata = unwrap(validatePackageJson(object))
        const withVersion = unwrap(validatePackageJsonWithVersion(object))
        assert(metadata.name === 'x', metadata)
        assert(withVersion.version === '1.0.0', withVersion)
        assert(object.private === true, object)
    },
}

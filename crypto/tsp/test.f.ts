import { encode, integer, octetString, constructedSequence, boolean } from '../../types/asn.1/module.f.ts'
import { length, uint, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { computeSync, sha256 } from '../sha2/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import {
    algorithmIdentifier,
    decodeResponse,
    encodeRequest,
    sha1Oid,
    sha256AlgorithmIdentifier,
    sha256Oid,
    sha512AlgorithmIdentifier,
    sha512Oid,
} from './module.f.ts'

// SHA-256 hash of the empty string
const emptyHash = computeSync(sha256)([])

// SHA-256 hash of "hello"
const helloHash = computeSync(sha256)([utf8('hello')])

const checkRequest = (algId: Vec, hash: Vec, certReq: boolean) => {
    const req = encodeRequest(algId)(hash)(certReq)
    // Must produce a non-empty SEQUENCE
    if (length(req) === 0n) { throw 'empty request' }
    // Outer tag must be 0x30 (CONSTRUCTED SEQUENCE)
    const firstByte = uint(req) >> (length(req) - 8n)
    if (firstByte !== 0x30n) { throw `wrong outer tag: ${firstByte.toString(16)}` }
}

export default {
    algorithmIdentifier: {
        sha256: () => {
            const algId = algorithmIdentifier(sha256Oid)
            if (length(algId) === 0n) { throw 'empty algId' }
            // Should start with SEQUENCE tag 0x30
            const firstByte = uint(algId) >> (length(algId) - 8n)
            if (firstByte !== 0x30n) { throw `wrong tag: ${firstByte.toString(16)}` }
        },
        sha512: () => {
            const algId = algorithmIdentifier(sha512Oid)
            if (length(algId) === 0n) { throw 'empty algId' }
            // SHA-512 OID and SHA-256 OID have the same number of components and
            // the same byte length. Both are longer than SHA-1.
            if (length(algId) !== length(sha256AlgorithmIdentifier)) {
                throw 'sha512 and sha256 algIds should have the same length'
            }
            // SHA-1 OID (1.3.14.3.2.26) is shorter than SHA-256 OID
            const sha1AlgId = algorithmIdentifier(sha1Oid)
            if (length(sha1AlgId) >= length(algId)) {
                throw 'sha1 algId should be shorter than sha256/sha512 algId'
            }
        },
    },
    encodeRequest: {
        sha256Empty: () => checkRequest(sha256AlgorithmIdentifier, emptyHash, true),
        sha256Hello: () => checkRequest(sha256AlgorithmIdentifier, helloHash, true),
        sha512: () => checkRequest(sha512AlgorithmIdentifier, emptyHash, false),
        certReqFalse: () => {
            const withCert = encodeRequest(sha256AlgorithmIdentifier)(helloHash)(true)
            const withoutCert = encodeRequest(sha256AlgorithmIdentifier)(helloHash)(false)
            // certReq=true adds a BOOLEAN TRUE field; certReq=false omits it (DEFAULT FALSE)
            if (length(withCert) <= length(withoutCert)) { throw 'certReq=true should produce a longer request' }
        },
        differentHashes: () => {
            const r1 = encodeRequest(sha256AlgorithmIdentifier)(emptyHash)(true)
            const r2 = encodeRequest(sha256AlgorithmIdentifier)(helloHash)(true)
            if (r1 === r2) { throw 'different hashes should produce different requests' }
        },
    },
    decodeResponse: {
        granted: () => {
            // Minimal TimeStampResp with status=0 (granted), no token
            // SEQUENCE {
            //   SEQUENCE { INTEGER 0 }   ; PKIStatusInfo
            // }
            const pkiStatusInfo = encode([constructedSequence, [[integer, 0n]]])
            const resp = encode([constructedSequence, [pkiStatusInfo]])
            const { status, token } = decodeResponse(resp)
            if (status !== 'granted') { throw `status: ${status}` }
            if (token !== null) { throw 'expected null token' }
        },
        rejection: () => {
            const pkiStatusInfo = encode([constructedSequence, [[integer, 2n]]])
            const resp = encode([constructedSequence, [pkiStatusInfo]])
            const { status, token } = decodeResponse(resp)
            if (status !== 'rejection') { throw `status: ${status}` }
            if (token !== null) { throw 'expected null token' }
        },
        grantedWithToken: () => {
            // Minimal TimeStampResp with status=0 and a fake token (OCTET STRING)
            const pkiStatusInfo = encode([constructedSequence, [[integer, 0n]]])
            // Fake token - just some bytes wrapped in a SEQUENCE (not a real ContentInfo)
            const fakeToken = encode([constructedSequence, [[octetString, vec8(0xABn)]]])
            const resp = encode([constructedSequence, [pkiStatusInfo, fakeToken]])
            const { status, token } = decodeResponse(resp)
            if (status !== 'granted') { throw `status: ${status}` }
            if (token === null) { throw 'expected non-null token' }
            if (token !== fakeToken) { throw 'token bytes mismatch' }
        },
        grantedWithMods: () => {
            const pkiStatusInfo = encode([constructedSequence, [[integer, 1n]]])
            const resp = encode([constructedSequence, [pkiStatusInfo]])
            const { status } = decodeResponse(resp)
            if (status !== 'grantedWithMods') { throw `status: ${status}` }
        },
        waiting: () => {
            const pkiStatusInfo = encode([constructedSequence, [[integer, 3n]]])
            const resp = encode([constructedSequence, [pkiStatusInfo]])
            const { status } = decodeResponse(resp)
            if (status !== 'waiting') { throw `status: ${status}` }
        },
    },
}

import {
    constructedSequence,
    constructedSet,
    decode,
    encode,
    encodeRaw,
    integer,
    boolean,
    octetString,
    objectIdentifier,
    type ObjectIdentifier,
    type Record,
    type Sequence,
} from '../../types/asn.1/module.f.ts'
import { isVec, vec8 } from '../../types/bit_vec/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import {
    decodeResponse,
    encodeRequest,
    sha256Oid,
    sha384Oid,
} from './module.f.ts'

const asSeq = (r: Record): Sequence => {
    if (!isVec(r) && r[0] === constructedSequence) { return r[1] }
    throw ['expected SEQUENCE', r]
}

const asInt = (r: Record): bigint => {
    if (!isVec(r) && r[0] === integer) { return r[1] }
    throw ['expected INTEGER', r]
}

const asBool = (r: Record): boolean => {
    if (!isVec(r) && r[0] === boolean) { return r[1] }
    throw ['expected BOOLEAN', r]
}

const asOid = (r: Record): ObjectIdentifier => {
    if (!isVec(r) && r[0] === objectIdentifier) { return r[1] }
    throw ['expected OID', r]
}

// OID: id-signedData 1.2.840.113549.1.7.2
const idSignedData: ObjectIdentifier = [1n, 2n, 840n, 113549n, 1n, 7n, 2n]

// OID: id-ct-TSTInfo 1.2.840.113549.1.9.16.1.4
const idCtTSTInfo: ObjectIdentifier = [1n, 2n, 840n, 113549n, 1n, 9n, 16n, 1n, 4n]

/**
 * Builds a minimal, well-formed TimeStampResp with the given status.
 * When status === 0 (granted), a ContentInfo / SignedData / TSTInfo
 * structure is included.
 */
const buildResponse = (status: bigint, genTimeStr: string, serialNumber: bigint, nonce?: bigint) => {
    const pkiStatusInfo: Record = encode([constructedSequence, [
        [integer, status],
    ]])

    if (status !== 0n && status !== 1n) {
        return encode([constructedSequence, [pkiStatusInfo]])
    }

    // genTime encoded as GeneralizedTime (tag 0x18)
    const genTime: Record = encodeRaw([0x18n, utf8(genTimeStr)])

    const nonceRecords: Record[] = nonce !== undefined ? [[integer, nonce]] : []

    // TSTInfo SEQUENCE
    const tstInfoSeq = encode([constructedSequence, [
        [integer, 1n] as Record,                          // version
        [objectIdentifier, sha256Oid] as Record,          // policy
        [constructedSequence, [                           // messageImprint
            [constructedSequence, [                       // hashAlgorithm
                [objectIdentifier, sha256Oid] as Record,
            ]] as Record,
            [octetString, vec8(0x42n)] as Record,         // hashedMessage
        ]] as Record,
        [integer, serialNumber] as Record,                // serialNumber
        genTime,                                          // genTime (UnsupportedRecord)
        ...nonceRecords,
    ]])

    // OCTET STRING wrapping TSTInfo
    const tstInfoOctetString = encode([octetString, tstInfoSeq])

    // [0] EXPLICIT OCTET STRING (eContent)
    const eContent: Record = encodeRaw([0xA0n, tstInfoOctetString])

    // EncapsulatedContentInfo SEQUENCE
    const encapContentInfo: Record = encode([constructedSequence, [
        [objectIdentifier, idCtTSTInfo] as Record,
        eContent,
    ]])

    // digestAlgorithms SET
    const digestAlgos: Record = encode([constructedSet, [
        [constructedSequence, [
            [objectIdentifier, sha256Oid] as Record,
        ]] as Record,
    ]])

    // SignedData SEQUENCE
    const signedData: Record = encode([constructedSequence, [
        [integer, 3n] as Record,          // version
        digestAlgos,                      // digestAlgorithms
        encapContentInfo,                 // encapContentInfo
        [constructedSet, []] as Record,   // signerInfos (empty)
    ]])

    // [0] EXPLICIT SignedData (ContentInfo.content)
    const contentField: Record = encodeRaw([0xA0n, signedData])

    // ContentInfo SEQUENCE (TimeStampToken)
    const contentInfo: Record = encode([constructedSequence, [
        [objectIdentifier, idSignedData] as Record,
        contentField,
    ]])

    return encode([constructedSequence, [pkiStatusInfo, contentInfo]])
}

export default {
    encodeRequest: {
        basic: () => {
            const hash = vec8(0x42n)
            const req = encodeRequest(sha256Oid, hash)
            const [rec] = decode(req)
            const seq = asSeq(rec)
            // version + messageImprint = 2 fields
            if (seq.length !== 2) { throw `length: ${seq.length}` }
            // version = 1
            if (asInt(seq[0]) !== 1n) { throw `version: ${asInt(seq[0])}` }
            // messageImprint is a SEQUENCE
            const msgImprint = asSeq(seq[1])
            // hashAlgorithm is a SEQUENCE containing the OID
            const algoId = asSeq(msgImprint[0])
            const oid = asOid(algoId[0])
            if (oid.length !== sha256Oid.length) { throw `oid length: ${oid.length}` }
            for (let i = 0; i < sha256Oid.length; i++) {
                if (oid[i] !== sha256Oid[i]) { throw `oid[${i}]: ${oid[i]}` }
            }
            // hashedMessage is the OCTET STRING
            const hmRec = msgImprint[1]
            if (!isVec(hmRec) && hmRec[0] !== octetString) { throw 'hashedMessage tag' }
        },
        withNonce: () => {
            const hash = vec8(0x13n)
            const req = encodeRequest(sha256Oid, hash, { nonce: 98765n })
            const [rec] = decode(req)
            const seq = asSeq(rec)
            // version + messageImprint + nonce = 3 fields
            if (seq.length !== 3) { throw `length: ${seq.length}` }
            if (asInt(seq[2]) !== 98765n) { throw `nonce: ${asInt(seq[2])}` }
        },
        withCertReq: () => {
            const hash = vec8(0x13n)
            const req = encodeRequest(sha256Oid, hash, { certReq: true })
            const [rec] = decode(req)
            const seq = asSeq(rec)
            // version + messageImprint + certReq = 3 fields
            if (seq.length !== 3) { throw `length: ${seq.length}` }
            if (asBool(seq[2]) !== true) { throw `certReq: ${asBool(seq[2])}` }
        },
        withReqPolicyAndNonce: () => {
            const hash = vec8(0x13n)
            const req = encodeRequest(sha384Oid, hash, {
                reqPolicy: sha256Oid,
                nonce: 42n,
            })
            const [rec] = decode(req)
            const seq = asSeq(rec)
            // version + messageImprint + reqPolicy + nonce = 4 fields
            if (seq.length !== 4) { throw `length: ${seq.length}` }
            // reqPolicy is an OID
            asOid(seq[2])
            // nonce is an INTEGER
            if (asInt(seq[3]) !== 42n) { throw `nonce: ${asInt(seq[3])}` }
        },
        certReqFalseAbsent: () => {
            // certReq DEFAULT FALSE must be absent in DER when false
            const req = encodeRequest(sha256Oid, vec8(0x42n), { certReq: false })
            const [rec] = decode(req)
            const seq = asSeq(rec)
            if (seq.length !== 2) { throw `certReq=false should be absent, length: ${seq.length}` }
        },
    },
    decodeResponse: {
        rejection: () => {
            const resp = buildResponse(2n, '', 0n)
            const r = decodeResponse(resp)
            if (r[0] === 'error') { throw r[1] }
            const result = r[1]
            if (result.status !== 'rejection') { throw result.status }
            if (result.tstInfo !== undefined) { throw 'expected no tstInfo' }
        },
        waiting: () => {
            const resp = buildResponse(3n, '', 0n)
            const r = decodeResponse(resp)
            if (r[0] === 'error') { throw r[1] }
            if (r[1].status !== 'waiting') { throw r[1].status }
        },
        granted: () => {
            const genTimeStr = '20240101120000Z'
            const resp = buildResponse(0n, genTimeStr, 12345n)
            const r = decodeResponse(resp)
            if (r[0] === 'error') { throw r[1] }
            const result = r[1]
            if (result.status !== 'granted') { throw result.status }
            const { tstInfo } = result
            if (tstInfo === undefined) { throw 'expected tstInfo' }
            if (tstInfo.version !== 1n) { throw `version: ${tstInfo.version}` }
            if (tstInfo.serialNumber !== 12345n) { throw `serial: ${tstInfo.serialNumber}` }
            if (tstInfo.genTime !== genTimeStr) { throw `genTime: ${tstInfo.genTime}` }
            if (tstInfo.nonce !== undefined) { throw `unexpected nonce: ${tstInfo.nonce}` }
            if (tstInfo.messageImprint.hashAlgorithm.length !== sha256Oid.length) {
                throw 'hashAlgorithm OID'
            }
        },
        grantedWithNonce: () => {
            const genTimeStr = '20260302123456Z'
            const resp = buildResponse(0n, genTimeStr, 99999n, 42n)
            const r = decodeResponse(resp)
            if (r[0] === 'error') { throw r[1] }
            const result = r[1]
            if (result.status !== 'granted') { throw result.status }
            const { tstInfo } = result
            if (tstInfo === undefined) { throw 'expected tstInfo' }
            if (tstInfo.serialNumber !== 99999n) { throw `serial: ${tstInfo.serialNumber}` }
            if (tstInfo.genTime !== genTimeStr) { throw `genTime: ${tstInfo.genTime}` }
            if (tstInfo.nonce !== 42n) { throw `nonce: ${tstInfo.nonce}` }
        },
    },
}

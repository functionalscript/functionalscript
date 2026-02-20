import { todo } from "../../dev/module.f.ts"
import type { Vec } from "../bit_vec/module.f.ts"

const eoc = 0x00
const boolean = 0x01
const integer = 0x02
const bitString = 0x03
const octetString = 0x04
const null_ = 0x05
const objectIdentifier = 0x06
const objectDescriptor = 0x07
const external = 0x08
const real = 0x09
const enumerated = 0x0A
const embeddedPdv = 0x0B
const utf8string = 0x0C
const relativeOid = 0x0D
const time = 0x0E
const sequence = 0x10
const set = 0x11
const numericString = 0x12
const printableString = 0x13
const t61String = 0x14
const videotexString = 0x15
const ia5String = 0x16
const utcTime = 0x17
const generalizedTime = 0x18
const graphicString = 0x19
const visibleString = 0x1A
const generalString = 0x1B
const universalString = 0x1C
const characterString = 0x1D
const bmpString = 0x1E
const date = 0x1F
const timeOfDay = 0x20
const dateTime = 0x21
const duration = 0x22
const oidIri = 0x23
const relativeOidIri = 0x24

const constructed = 0x20

const constructedSequence = constructed | sequence

export type Tag = number

export const encode = (tag: Tag, value: Vec): Vec => todo()

export const decode = (v: Vec): readonly[number, Vec] => todo()

/*
TimeStampReq ::= SEQUENCE {
   version        INTEGER { v1(1) },
   messageImprint MessageImprint,
   reqPolicy      TSAPolicyId OPTIONAL,
   nonce          INTEGER OPTIONAL,
   certReq        BOOLEAN DEFAULT FALSE,
   extensions     [0] IMPLICIT Extensions OPTIONAL
}

MessageImprint ::= SEQUENCE {
   hashAlgorithm  AlgorithmIdentifier,
   hashedMessage  OCTET STRING
}

TSAPolicyId ::= OBJECT IDENTIFIER
*/

/*
TimeStampResp ::= SEQUENCE {
   status          PKIStatusInfo,
   timeStampToken  TimeStampToken OPTIONAL
}

PKIStatusInfo ::= SEQUENCE {
   status        PKIStatus,
   statusString  PKIFreeText OPTIONAL,
   failInfo      PKIFailureInfo OPTIONAL
}

PKIStatus ::= INTEGER {
   granted                (0),
   grantedWithMods        (1),
   rejection              (2),
   waiting                (3),
   revocationWarning      (4),
   revocationNotification (5)
}

TimeStampToken ::= ContentInfo

ContentInfo ::= SEQUENCE {
   contentType ContentType,
   content     [0] EXPLICIT ANY DEFINED BY contentType
}

ContentType ::= OBJECT IDENTIFIER

SignedData ::= SEQUENCE {
   version CMSVersion,
   digestAlgorithms SET OF DigestAlgorithmIdentifier,
   encapContentInfo EncapsulatedContentInfo,
   certificates     [0] IMPLICIT CertificateSet OPTIONAL,
   crls             [1] IMPLICIT RevocationInfoChoices OPTIONAL,
   signerInfos      SET OF SignerInfo
}

EncapsulatedContentInfo ::= SEQUENCE {
   eContentType ContentType,
   eContent     [0] EXPLICIT OCTET STRING OPTIONAL
}

TSTInfo ::= SEQUENCE  {
   version        INTEGER  { v1(1) },
   policy         TSAPolicyId,
   messageImprint MessageImprint,
   serialNumber   INTEGER,
   genTime        GeneralizedTime,
   accuracy       Accuracy OPTIONAL,
   ordering       BOOLEAN DEFAULT FALSE,
   nonce          INTEGER OPTIONAL,
   tsa            [0] GeneralName OPTIONAL,
   extensions     [1] IMPLICIT Extensions OPTIONAL
}

Bits:  8 7   | 6    | 5 4 3 2 1
       Class | P/C  | Tag number
*/

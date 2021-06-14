/**
 * Copyright 2021 Cloudflare Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ExpProof, proveExp, verifyExp } from './exp/exp.js'
import { GKProof, proveMembership, verifyMembership } from './proofGK/gk.js'
import { PedersenParams, generatePedersenParams } from './commit/pedersen.js'
import { bitLen, fromBytes, invMod, posMod } from './bignum/big.js'
import { jsonArrayMember, jsonMember, jsonObject, toJson } from 'typedjson'
import { p256, tomEdwards256 } from './curves/instances.js'

import { Group } from './curves/group.js'
import { cmpArray } from './util.js'

@jsonObject
@toJson
export class SignatureProofList {
    @jsonMember({ constructor: Group.Point, isRequired: true }) R: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) comS1: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) keyXcom: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) keyYcom: Group.Point
    @jsonArrayMember(ExpProof, { isRequired: true }) expProof: ExpProof[]
    @jsonMember({ constructor: GKProof, isRequired: true }) membershipProof: GKProof
    constructor(
        R: Group.Point,
        comS1: Group.Point,
        keyXcom: Group.Point,
        keyYcom: Group.Point,
        expProof: ExpProof[],
        membershipProof: GKProof
    ) {
        this.R = R
        this.comS1 = comS1
        this.keyXcom = keyXcom
        this.keyYcom = keyYcom
        this.expProof = expProof
        this.membershipProof = membershipProof
    }
    eq(o: SignatureProofList): boolean {
        return (
            this.R.eq(o.R) &&
            this.comS1.eq(o.comS1) &&
            this.keyXcom.eq(o.keyXcom) &&
            this.keyYcom.eq(o.keyYcom) &&
            cmpArray(this.expProof, o.expProof) &&
            this.membershipProof.eq(o.membershipProof)
        )
    }
}

@jsonObject
@toJson
export class SystemParametersList {
    @jsonMember({ constructor: PedersenParams, isRequired: true }) NistGroup: PedersenParams
    @jsonMember({ constructor: PedersenParams, isRequired: true }) ProofGroup: PedersenParams
    @jsonMember({ constructor: Number, isRequired: true }) SecLevel: number

    constructor(NistGroup: PedersenParams, ProofGroup: PedersenParams, SecLevel: number) {
        this.NistGroup = NistGroup
        this.ProofGroup = ProofGroup
        this.SecLevel = SecLevel
    }
    eq(o: SystemParametersList): boolean {
        return this.NistGroup.eq(o.NistGroup) && this.ProofGroup.eq(o.ProofGroup) && this.SecLevel == o.SecLevel
    }
}

function truncateToN(msg: bigint, n: bigint): bigint {
    const delta = bitLen(msg) - bitLen(n)
    if (delta > 0) {
        msg >>= BigInt(delta)
    }
    return msg
}

export function generateParamsList(secLevel = 80): SystemParametersList {
    const nistGroup = generatePedersenParams(p256),
        proofGroup = generatePedersenParams(tomEdwards256)
    return new SystemParametersList(nistGroup, proofGroup, secLevel)
}

export async function keyToInt(publicKey: CryptoKey): Promise<bigint> {
    const pkBytes = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)),
        pkPoint = p256.deserializePoint(pkBytes),
        pkCoords = pkPoint.toAffine()
    if (!pkCoords) {
        throw new Error('invalid public key')
    }
    return pkCoords.x
}

export async function proveSignatureList(
    params: SystemParametersList,
    msgHash: Uint8Array,
    sigBytes: Uint8Array,
    publicKey: CryptoKey,
    which: number,
    keys: bigint[]
): Promise<SignatureProofList> {
    const ec = p256,
        pkBytes = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)),
        pkPoint = p256.deserializePoint(pkBytes),
        pkCoords = pkPoint.toAffine()
    if (!pkCoords) {
        throw new Error('invalid public key')
    }
    const len = sigBytes.length,
        groupOrder = ec.order,
        z = truncateToN(fromBytes(msgHash), groupOrder),
        r = fromBytes(sigBytes.slice(0, len / 2)),
        s = fromBytes(sigBytes.slice(len / 2)),
        // First we do a signature verification to recover R
        sinv = invMod(s, groupOrder),
        u1 = posMod(sinv * z, groupOrder),
        u2 = posMod(sinv * r, groupOrder),
        R = ec
            .generator()
            .mul(ec.newScalar(u1))
            .add(pkPoint.mul(ec.newScalar(u2))),
        // Now we compute the remaining parts of the signature
        rinv = invMod(r, groupOrder),
        s1 = posMod(rinv * s, groupOrder),
        z1 = posMod(rinv * z, groupOrder),
        Q = ec.generator().mul(ec.newScalar(z1)),
        paramsSigExp = new PedersenParams(p256, R, params.NistGroup.h),
        comS1 = paramsSigExp.commit(s1),
        pkX = params.ProofGroup.commit(pkCoords.x),
        pkY = params.ProofGroup.commit(pkCoords.y),
        sigProof = await proveExp(paramsSigExp, params.ProofGroup, s1, comS1, pkPoint, pkX, pkY, params.SecLevel, Q), // TODO: raise!
        membershipProof = await proveMembership(params.ProofGroup, pkX, which, keys)

    return new SignatureProofList(R, comS1.p, pkX.p, pkY.p, sigProof, membershipProof)
}

export async function verifySignatureList(
    params: SystemParametersList,
    msgHash: Uint8Array,
    keys: bigint[],
    proof: SignatureProofList
): Promise<boolean> {
    const ec = p256,
        groupOrder = ec.order,
        z = truncateToN(fromBytes(msgHash), groupOrder),
        R = proof.R,
        coordR = R.toAffine()
    if (!coordR) {
        throw new Error('R is at infinity')
    }
    const rinv = invMod(coordR.x, groupOrder),
        paramsSigExp = new PedersenParams(p256, R, params.NistGroup.h),
        z1 = posMod(rinv * z, groupOrder),
        Q = ec.generator().mul(ec.newScalar(z1))
    if (!(await verifyMembership(params.ProofGroup, proof.keyXcom, keys, proof.membershipProof))) {
        return false
    }

    if (
        !(await verifyExp(
            paramsSigExp,
            params.ProofGroup,
            proof.comS1,
            proof.keyXcom,
            proof.keyYcom,
            proof.expProof,
            20,
            Q
        ))
    ) {
        return false
    }
    return true
}

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

import { Commitment, PedersenParams } from '../commit/pedersen.js'
import { Group, hashPoints } from '../curves/group.js'
import { MultiMult, Relation } from '../curves/multimult.js'
import { PointAddProof, aggregatePointAdd, provePointAdd } from './pointAdd.js'
import { isOdd, rndRange } from '../bignum/big.js'
import { jsonMember, jsonObject, toJson } from 'typedjson'

@jsonObject
@toJson
export class ExpProof {
    @jsonMember({ constructor: Group.Point, isRequired: true }) A: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) Tx: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) Ty: Group.Point
    //response1
    @jsonMember({ constructor: Group.Scalar }) alpha?: Group.Scalar
    @jsonMember({ constructor: Group.Scalar }) beta1?: Group.Scalar
    @jsonMember({ constructor: Group.Scalar }) beta2?: Group.Scalar
    @jsonMember({ constructor: Group.Scalar }) beta3?: Group.Scalar
    //response0
    @jsonMember({ constructor: Group.Scalar }) z?: Group.Scalar
    @jsonMember({ constructor: Group.Scalar }) z2?: Group.Scalar
    @jsonMember({ constructor: PointAddProof }) proof?: PointAddProof
    @jsonMember({ constructor: Group.Scalar }) r1?: Group.Scalar
    @jsonMember({ constructor: Group.Scalar }) r2?: Group.Scalar

    constructor(
        A: Group.Point,
        Tx: Group.Point,
        Ty: Group.Point,
        alpha?: Group.Scalar,
        beta1?: Group.Scalar,
        beta2?: Group.Scalar,
        beta3?: Group.Scalar,
        z?: Group.Scalar,
        z2?: Group.Scalar,
        proof?: PointAddProof,
        r1?: Group.Scalar,
        r2?: Group.Scalar
    ) {
        this.A = A
        this.Tx = Tx
        this.Ty = Ty
        this.alpha = alpha
        this.beta1 = beta1
        this.beta2 = beta2
        this.beta3 = beta3
        this.z = z
        this.z2 = z2
        this.proof = proof
        this.r1 = r1
        this.r2 = r2
    }
    eq(o: ExpProof): boolean {
        const c0 = this.A.eq(o.A) && this.Tx.eq(o.Tx) && this.Ty.eq(o.Ty),
            r0 =
                (this.alpha && o.alpha ? this.alpha.eq(o.alpha) : false) &&
                (this.beta1 && o.beta1 ? this.beta1.eq(o.beta1) : false) &&
                (this.beta2 && o.beta2 ? this.beta2.eq(o.beta2) : false) &&
                (this.beta3 && o.beta3 ? this.beta3.eq(o.beta3) : false),
            r1 =
                (this.z && o.z ? this.z.eq(o.z) : false) &&
                (this.z2 && o.z2 ? this.z2.eq(o.z2) : false) &&
                (this.proof && o.proof ? this.proof.eq(o.proof) : false) &&
                (this.r1 && o.r1 ? this.r1.eq(o.r1) : false) &&
                (this.r2 && o.r2 ? this.r2.eq(o.r2) : false)
        return c0 && (r0 || r1)
    }
}

function paddedBits(val: bigint, length: number): boolean[] {
    const ret = []
    for (let i = 0; i < length; i++) {
        ret[i] = val % BigInt(2) == BigInt(1)
        val >>= BigInt(1)
    }
    return ret
}

function generateIndices(indnum: number, limit: number): number[] {
    const ret: number[] = []
    for (let i = 0; i < limit; i++) {
        ret[i] = i
    }
    // Algorithm P, Seminumerical algorithms, Knuth.
    for (let i = 0; i < limit - 2; i++) {
        const j = Number(rndRange(BigInt(i), BigInt(limit - 1))),
            k = ret[i]
        ret[i] = ret[j]
        ret[j] = k
    }
    ret.slice(indnum)
    return ret
}

/**
 * ZK(s, r, rx, ry: sR = P + Q and Cs = sR + rS and Cx = Px G + rx H and Cy = Py G + ry H) [Q is optional]
 * paramsNIST.g = R [Point R must be populated in the g field of paramsNIST]
 *
 * @param paramsNIST NIST params
 * @param paramsWario Wario params
 * @param s secret
 * @param Cs: commitment to the secret with params NIST
 * @param rx
 * @param ry
 * @param Px
 * @param Py
 * @param Q an optional public point
 * @param secparam Soundness error
 */
export async function proveExp(
    paramsNIST: PedersenParams,
    paramsWario: PedersenParams,
    s: bigint,
    Cs: Commitment,
    P: Group.Point,
    Px: Commitment,
    Py: Commitment,
    secparam: number,
    Q?: Group.Point
): Promise<Array<ExpProof>> {
    const alpha = new Array<Group.Scalar>(secparam),
        r = new Array<Group.Scalar>(secparam),
        T = new Array<Group.Point>(secparam),
        A = new Array<Group.Point>(secparam),
        Tx = new Array<Commitment>(secparam),
        Ty = new Array<Commitment>(secparam)

    for (let i = 0; i < secparam; i++) {
        alpha[i] = paramsNIST.c.randomScalar()
        r[i] = paramsNIST.c.randomScalar()
        T[i] = paramsNIST.g.mul(alpha[i])
        A[i] = T[i].add(paramsNIST.h.mul(r[i]))
        const coordT = T[i].toAffine()
        if (!coordT) {
            throw new Error('T[i] is at infinity')
        }
        const { x, y } = coordT
        Tx[i] = paramsWario.commit(x)
        Ty[i] = paramsWario.commit(y)
    }

    // Compute challenge c = H (Cx, Cy, A, Tx, Ty)
    const arr = [Px.p, Py.p]
    for (let i = 0; i < secparam; i++) {
        arr.push(A[i])
        arr.push(Tx[i].p)
        arr.push(Ty[i].p)
    }
    let challenge = await hashPoints('SHA-256', arr)
    const allProofs = new Array<ExpProof>(secparam)
    let proof: ExpProof
    for (let i = 0; i < secparam; i++) {
        if (isOdd(challenge)) {
            proof = new ExpProof(
                A[i],
                Tx[i].p,
                Ty[i].p,
                alpha[i],
                r[i],
                Tx[i].r,
                Ty[i].r,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            )
        } else {
            // z = alpha - s
            const z = alpha[i].sub(paramsNIST.c.newScalar(s))
            let T1 = paramsNIST.g.mul(z)
            if (Q) {
                T1 = T1.add(Q)
            }
            const coordT1 = T1.toAffine()
            if (!coordT1) {
                throw new Error('T1 is at infinity')
            }
            const { x, y } = coordT1,
                T1x = paramsWario.commit(x),
                T1y = paramsWario.commit(y),
                // alpha R - s R = z R => T1 + P = T
                pointAddProof = await provePointAdd(paramsWario, T1, P, T[i], T1x, T1y, Px, Py, Tx[i], Ty[i])

            proof = new ExpProof(
                A[i],
                Tx[i].p,
                Ty[i].p,
                undefined,
                undefined,
                undefined,
                undefined,
                z,
                r[i].sub(Cs.r),
                pointAddProof,
                T1x.r,
                T1y.r
            )
        }
        allProofs[i] = proof
        challenge >>= BigInt(1)
    }
    return allProofs
}

export async function verifyExp(
    paramsNIST: PedersenParams,
    paramsWario: PedersenParams,
    Clambda: Group.Point,
    Px: Group.Point,
    Py: Group.Point,
    pi: Array<ExpProof>,
    secparam: number,
    Q?: Group.Point
): Promise<boolean> {
    if (secparam > pi.length) {
        throw new Error('security level not achieved')
    }
    const multiW = new MultiMult(paramsWario.c),
        multiN = new MultiMult(paramsNIST.c)
    multiW.addKnown(paramsWario.g)
    multiW.addKnown(paramsWario.h)
    multiN.addKnown(paramsNIST.g)
    multiN.addKnown(paramsNIST.h)
    multiN.addKnown(Clambda)
    const arr = [Px, Py]
    for (let i = 0; i < pi.length; i++) {
        arr.push(pi[i].A)
        arr.push(pi[i].Tx)
        arr.push(pi[i].Ty)
    }

    const challenge = await hashPoints('SHA-256', arr),
        indices = generateIndices(secparam, pi.length),
        challengeBits = paddedBits(challenge, pi.length)
    for (let j = 0; j < secparam; j++) {
        const i = indices[j]
        //const { commitment, response } = pi[i]

        if (challengeBits[i]) {
            const resp = {
                    alpha: pi[i].alpha!,
                    beta1: pi[i].beta1!,
                    beta2: pi[i].beta2!,
                    beta3: pi[i].beta3!,
                },
                T = paramsNIST.g.mul(resp.alpha),
                relA = new Relation(paramsNIST.c)
            relA.insertM(
                [T, paramsNIST.h, pi[i].A.neg()],
                [paramsNIST.c.newScalar(BigInt(1)), resp.beta1, paramsNIST.c.newScalar(BigInt(1))]
            )
            relA.drain(multiN)
            const coordT = T.toAffine()
            if (!coordT) {
                throw new Error('T is at infinity')
            }

            const sx = paramsWario.c.newScalar(coordT.x),
                sy = paramsWario.c.newScalar(coordT.y),
                relTx = new Relation(paramsWario.c),
                relTy = new Relation(paramsWario.c)
            relTx.insertM(
                [paramsWario.g, paramsWario.h, pi[i].Tx.neg()],
                [sx, resp.beta2, paramsWario.c.newScalar(BigInt(1))]
            )
            relTy.insertM(
                [paramsWario.g, paramsWario.h, pi[i].Ty.neg()],
                [sy, resp.beta3, paramsWario.c.newScalar(BigInt(1))]
            )
            relTx.drain(multiW)
            relTy.drain(multiW)
        } else {
            const resp = {
                z: pi[i].z!,
                z2: pi[i].z2!,
                proof: pi[i].proof!,
                r1: pi[i].r1!,
                r2: pi[i].r2!,
            }
            let T1 = paramsNIST.g.mul(resp.z)
            const relA = new Relation(paramsNIST.c)
            relA.insertM(
                [T1, Clambda, pi[i].A.neg(), paramsNIST.h],
                [
                    paramsNIST.c.newScalar(BigInt(1)),
                    paramsNIST.c.newScalar(BigInt(1)),
                    paramsNIST.c.newScalar(BigInt(1)),
                    resp.z2,
                ]
            )
            relA.drain(multiN)

            if (Q) {
                T1 = T1.add(Q)
            }

            const coordT1 = T1.toAffine()
            if (!coordT1) {
                throw new Error('T1 is at infinity')
            }

            const sx = paramsWario.c.newScalar(coordT1.x),
                sy = paramsWario.c.newScalar(coordT1.y),
                T1x = paramsWario.g.dblmul(sx, paramsWario.h, resp.r1),
                T1y = paramsWario.g.dblmul(sy, paramsWario.h, resp.r2)
            if (!(await aggregatePointAdd(paramsWario, T1x, T1y, Px, Py, pi[i].Tx, pi[i].Ty, resp.proof, multiW))) {
                return false
            }
        }
    }
    return multiW.evaluate().isIdentity() && multiN.evaluate().isIdentity()
}

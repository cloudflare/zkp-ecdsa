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

// Prove equality between two commitments to the same value
import { Commitment, PedersenParams } from './pedersen.js'
import { Group, hashPoints } from '../curves/group.js'
import { MultiMult, Relation } from '../curves/multimult.js'
import { jsonMember, jsonObject, toJson } from 'typedjson'

import { rnd } from '../bignum/big.js'

@jsonObject
@toJson
export class EqualityProof {
    @jsonMember({ constructor: Group.Point, isRequired: true }) A_1: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) A_2: Group.Point
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_x: Group.Scalar
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_r1: Group.Scalar
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_r2: Group.Scalar

    constructor(A_1: Group.Point, A_2: Group.Point, t_x: Group.Scalar, t_r1: Group.Scalar, t_r2: Group.Scalar) {
        this.A_1 = A_1
        this.A_2 = A_2
        this.t_x = t_x
        this.t_r1 = t_r1
        this.t_r2 = t_r2
    }
    eq(o: EqualityProof): boolean {
        return (
            this.A_1.eq(o.A_1) &&
            this.A_2.eq(o.A_2) &&
            this.t_x.eq(o.t_x) &&
            this.t_r1.eq(o.t_r1) &&
            this.t_r2.eq(o.t_r2)
        )
    }
}

/**
 * ZK(x, r1, r2: C1 = xG + r1H and C2 = xG + r2H)
 *
 * @param params
 * @param x
 * @param C1
 * @param C2
 */
export async function proveEquality(
    params: PedersenParams,
    x: bigint,
    C1: Commitment,
    C2: Commitment
): Promise<EqualityProof> {
    const k = rnd(params.c.order),
        A1 = params.commit(k),
        A2 = params.commit(k),
        c = await hashPoints('SHA-256', [C1.p, C2.p, A1.p, A2.p]),
        cc = params.c.newScalar(c),
        xx = params.c.newScalar(x),
        kk = params.c.newScalar(k),
        tx = kk.sub(cc.mul(xx)), //      t_x = k - cx
        tr1 = A1.r.sub(cc.mul(C1.r)), //  t_r1 = s1 - c r1
        tr2 = A2.r.sub(cc.mul(C2.r)) //  t_r2 = s2 - c r2

    return new EqualityProof(A1.p, A2.p, tx, tr1, tr2)
}

export async function verifyEquality(
    params: PedersenParams,
    C1: Group.Point,
    C2: Group.Point,
    pi: EqualityProof
): Promise<boolean> {
    const multi = new MultiMult(params.c),
        ok = await aggregateEquality(params, C1, C2, pi, multi)
    if (!ok) {
        return false
    }
    return multi.evaluate().isIdentity()
}

export async function aggregateEquality(
    params: PedersenParams,
    C1: Group.Point,
    C2: Group.Point,
    pi: EqualityProof,
    multi: MultiMult
): Promise<boolean> {
    const challenge = await hashPoints('SHA-256', [C1, C2, pi.A_1, pi.A_2]),
        cc = params.c.newScalar(challenge),
        A1rel = new Relation(params.c)
    A1rel.insert(params.g, pi.t_x)
    A1rel.insert(params.h, pi.t_r1)
    A1rel.insert(C1, cc)
    A1rel.insert(pi.A_1.neg(), params.c.newScalar(BigInt(1)))
    const A2rel = new Relation(params.c)
    A2rel.insert(params.g, pi.t_x)
    A2rel.insert(params.h, pi.t_r2)
    A2rel.insert(C2, cc)
    A2rel.insert(pi.A_2.neg(), params.c.newScalar(BigInt(1)))
    A1rel.drain(multi)
    A2rel.drain(multi)
    return true
}

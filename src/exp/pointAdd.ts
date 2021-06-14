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
import { EqualityProof, aggregateEquality, proveEquality } from '../commit/equality.js'
import { MultProof, aggregateMult, proveMult } from '../commit/mult.js'
import { invMod, posMod } from '../bignum/big.js'
import { jsonMember, jsonObject, toJson } from 'typedjson'

import { Group } from '../curves/group.js'
import { MultiMult } from '../curves/multimult.js'

@jsonObject
@toJson
export class PointAddProof {
    @jsonMember({ constructor: Group.Point, isRequired: true }) C_8: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) C_10: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) C_11: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) C_13: Group.Point
    @jsonMember({ constructor: MultProof, isRequired: true }) pi_8: MultProof
    @jsonMember({ constructor: MultProof, isRequired: true }) pi_10: MultProof
    @jsonMember({ constructor: MultProof, isRequired: true }) pi_11: MultProof
    @jsonMember({ constructor: MultProof, isRequired: true }) pi_13: MultProof
    @jsonMember({ constructor: EqualityProof, isRequired: true }) pi_x: EqualityProof
    @jsonMember({ constructor: EqualityProof, isRequired: true }) pi_y: EqualityProof
    constructor(
        C_8: Group.Point,
        C_10: Group.Point,
        C_11: Group.Point,
        C_13: Group.Point,
        pi_8: MultProof,
        pi_10: MultProof,
        pi_11: MultProof,
        pi_13: MultProof,
        pi_x: EqualityProof,
        pi_y: EqualityProof
    ) {
        this.C_8 = C_8
        this.C_10 = C_10
        this.C_11 = C_11
        this.C_13 = C_13
        this.pi_8 = pi_8
        this.pi_10 = pi_10
        this.pi_11 = pi_11
        this.pi_13 = pi_13
        this.pi_x = pi_x
        this.pi_y = pi_y
    }
    eq(o: PointAddProof): boolean {
        return (
            this.C_8.eq(o.C_8) &&
            this.C_10.eq(o.C_10) &&
            this.C_11.eq(o.C_11) &&
            this.C_13.eq(o.C_13) &&
            this.pi_8.eq(o.pi_8) &&
            this.pi_10.eq(o.pi_10) &&
            this.pi_11.eq(o.pi_11) &&
            this.pi_13.eq(o.pi_13) &&
            this.pi_x.eq(o.pi_x) &&
            this.pi_y.eq(o.pi_y)
        )
    }
}

/**
 * ZK(P, Q, R: R = P + Q)
 *
 * @param params
 * @param P (x1, y1)
 * @param Q (x2, y2)
 * @param R (x3, y3)
 * @param C1 x1 = PX
 * @param C2 x2 = QX
 * @param C3 x3 = RX
 * @param C4 y1 = PY
 * @param C5 y2 = QY
 * @param C6 y3 = RY
 */
export async function provePointAdd(
    params: PedersenParams,
    P: Group.Point,
    Q: Group.Point,
    R: Group.Point,
    PX: Commitment,
    PY: Commitment,
    QX: Commitment,
    QY: Commitment,
    RX: Commitment,
    RY: Commitment
): Promise<PointAddProof> {
    if (!P.add(Q).eq(R)) {
        throw Error("Points don't add up!")
    }
    const prime = params.c.order,
        C1 = PX,
        C2 = QX,
        C3 = RX,
        C4 = PY,
        C5 = QY,
        C6 = RY,
        coordP = P.toAffine(),
        coordQ = Q.toAffine(),
        coordR = R.toAffine()
    if (!coordP) {
        throw new Error('P is at infinity')
    }
    if (!coordQ) {
        throw new Error('Q is at infinity')
    }
    if (!coordR) {
        throw new Error('R is at infinity')
    }
    const { x: x1, y: y1 } = coordP,
        { x: x2, y: y2 } = coordQ,
        { x: x3 } = coordR, // todo(question): why y3 is not used?
        // intermediates and commitments
        i7 = posMod(x2 - x1, prime), //    i7  = x2 - x1
        i8 = invMod(i7, prime), //         i8  = (x2 - x1)^-1
        i9 = posMod(y2 - y1, prime), //    i9  = y2 - y1
        i10 = posMod(i8 * i9, prime), //   i10 = i8 * i9 =  (y2 - y1) / (x2 - x1)
        i11 = posMod(i10 * i10, prime), // i11 = (i10)^2
        i12 = posMod(x1 - x3, prime), //   i12 = x1 - x3
        i13 = posMod(i10 * i12, prime), // i13 = i10 * i12
        C7 = C2.sub(C1),
        C8 = params.commit(i8),
        C9 = C5.sub(C4),
        C10 = params.commit(i10),
        C11 = params.commit(i11),
        C12 = C1.sub(C3),
        C13 = params.commit(i13),
        C14 = new Commitment(params.g, params.c.newScalar(BigInt(0))),
        pi8 = await proveMult(params, i7, i8, BigInt(1), C7, C8, C14),
        // pi10 => i10 = i8 * i9
        pi10 = await proveMult(params, i8, i9, i10, C8, C9, C10),
        // pi11 => i11 = i10 * i10
        pi11 = await proveMult(params, i10, i10, i11, C10, C10, C11)

    let Cint = new Commitment(C3.p.add(C1.p).add(C2.p), C3.r.add(C1.r).add(C2.r))
    const // pix => x3 = i11 - x1 - x2
        pix = await proveEquality(params, i11, C11, Cint),
        // pi12 => i12 = x1 - x3
        // pi13 => i13 = i10 * i12
        pi13 = await proveMult(params, i10, i12, i13, C10, C12, C13)

    Cint = new Commitment(C6.p.add(C4.p), C6.r.add(C4.r))
    const // piy => y3 = i13 - y1
        piy = await proveEquality(params, i13, C13, Cint)

    return new PointAddProof(C8.p, C10.p, C11.p, C13.p, pi8, pi10, pi11, pi13, pix, piy)
}

/**
 * ZKP Verification ZK(P, Q, R: P + Q = R)
 * P (x1, y1)
 * Q (x2, y2)
 * R (x3, y3)
 *
 * @param params
 * @param C1 x1
 * @param C2 x2
 * @param C3 x3
 * @param C4 y1
 * @param C5 y2
 * @param C6 y3
 * @param pi
 * @param challenge
 */
export async function verifyPointAdd(
    params: PedersenParams,
    PX: Group.Point,
    PY: Group.Point,
    QX: Group.Point,
    QY: Group.Point,
    RX: Group.Point,
    RY: Group.Point,
    pi: PointAddProof
): Promise<boolean> {
    const multi = new MultiMult(params.c),
        ok = await aggregatePointAdd(params, PX, PY, QX, QY, RX, RY, pi, multi)
    if (!ok) {
        return false
    }
    return multi.evaluate().isIdentity()
}

export async function aggregatePointAdd(
    params: PedersenParams,
    PX: Group.Point,
    PY: Group.Point,
    QX: Group.Point,
    QY: Group.Point,
    RX: Group.Point,
    RY: Group.Point,
    pi: PointAddProof,
    multi: MultiMult
): Promise<boolean> {
    const C1 = PX,
        C2 = QX,
        C3 = RX,
        C4 = PY,
        C5 = QY,
        C6 = RY,
        C7 = C2.sub(C1),
        C9 = C5.sub(C4),
        C12 = C1.sub(C3),
        // pi8 => C8 * C7 = C14 and C14 == 1
        C_14 = params.g
    if (!(await aggregateMult(params, C7, pi.C_8, C_14, pi.pi_8, multi))) {
        console.log('pi8')
        return false
    }

    // pi10 => i10 = i8 * i9
    if (!(await aggregateMult(params, pi.C_8, C9, pi.C_10, pi.pi_10, multi))) {
        console.log('pi10')
        return false
    }

    // pi11 => i11 = i10 * i10
    if (!(await aggregateMult(params, pi.C_10, pi.C_10, pi.C_11, pi.pi_11, multi))) {
        console.log('pi11')
        return false
    }

    // pix => x3 = i11 - x1 - x2
    let Cint = C3.add(C1).add(C2)
    if (!(await aggregateEquality(params, pi.C_11, Cint, pi.pi_x, multi))) {
        console.log('pix')
        return false
    }

    // pi13 => i13 = i10 * i12
    if (!(await aggregateMult(params, pi.C_10, C12, pi.C_13, pi.pi_13, multi))) {
        console.log('pi13')
        return false
    }

    // piy => y3 = i13 - y1
    Cint = C4.add(C6)
    if (!(await aggregateEquality(params, pi.C_13, Cint, pi.pi_y, multi))) {
        console.log('piy')
        return false
    }

    return true
}

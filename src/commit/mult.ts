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

import { Commitment, PedersenParams } from './pedersen.js'
import { Group, hashPoints } from '../curves/group.js'
import { MultiMult, Relation } from '../curves/multimult.js'
import { jsonMember, jsonObject, toJson } from 'typedjson'

import { rnd } from '../bignum/big.js'

@jsonObject
@toJson
export class MultProof {
    @jsonMember({ constructor: Group.Point, isRequired: true }) A_x: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) A_y: Group.Point
    @jsonMember({ constructor: Group.Point, isRequired: true }) A_4_2: Group.Point
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_x: Group.Scalar
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_y: Group.Scalar
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_rx: Group.Scalar
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_ry: Group.Scalar
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) t_r4: Group.Scalar

    constructor(
        A_x: Group.Point,
        A_y: Group.Point,
        A_4_2: Group.Point,
        t_x: Group.Scalar,
        t_y: Group.Scalar,
        t_rx: Group.Scalar,
        t_ry: Group.Scalar,
        t_r4: Group.Scalar
    ) {
        this.A_x = A_x
        this.A_y = A_y
        this.A_4_2 = A_4_2
        this.t_x = t_x
        this.t_y = t_y
        this.t_rx = t_rx
        this.t_ry = t_ry
        this.t_r4 = t_r4
    }
    eq(o: MultProof): boolean {
        return (
            this.A_x.eq(o.A_x) &&
            this.A_y.eq(o.A_y) &&
            this.A_4_2.eq(o.A_4_2) &&
            this.t_x.eq(o.t_x) &&
            this.t_y.eq(o.t_y) &&
            this.t_rx.eq(o.t_rx) &&
            this.t_ry.eq(o.t_ry) &&
            this.t_r4.eq(o.t_r4)
        )
    }
}

/*
    Proof of multiplication
    ZK(x, y, z, rx, ry, rz: z = x * y and Cx = xG + rx H and Cy = yG + ry H and Cz = zG + rz H)
*/
export async function proveMult(
    params: PedersenParams,
    x: bigint,
    y: bigint,
    _z: bigint,
    Cx: Commitment,
    Cy: Commitment,
    Cz: Commitment
): Promise<MultProof> {
    const xx = params.c.newScalar(x),
        // Step 1: Compute commitments
        k_x = rnd(params.c.order),
        k_y = rnd(params.c.order),
        k_z = rnd(params.c.order),
        ky = params.c.newScalar(k_y),
        kz = params.c.newScalar(k_z),
        Ax = params.commit(k_x),
        Ay = params.commit(k_y),
        A4_2 = (Cx.p.mul(ky)).add(params.h.mul(kz)),
        // Step 2: Compute challenge  H(Cx, Cy, Cz, C4, Ax, Ay, Az, A4_1, A4_2)
        c = await hashPoints('SHA-256', [Cx.p, Cy.p, Cz.p, Ax.p, Ay.p, A4_2]),
        cc = params.c.newScalar(c),
        kx = params.c.newScalar(k_x),
        yy = params.c.newScalar(y),
        t_x = kx.sub(cc.mul(xx)), // tx = kx-c*x
        t_y = ky.sub(cc.mul(yy)), // ty = ky-c*y
        t_rx = Ax.r.sub(cc.mul(Cx.r)), //  t_rx = sx-c*rx
        t_ry = Ay.r.sub(cc.mul(Cy.r)), //  t_ry = sy-c*ry
        t_r4 = kz.sub(cc.mul(Cz.r.sub(Cx.r.mul(yy)))) //  t_r4 = s4-c*r4

    return new MultProof(Ax.p, Ay.p, A4_2, t_x, t_y, t_rx, t_ry, t_r4)
}

export async function verifyMult(
    params: PedersenParams,
    Cx: Group.Point,
    Cy: Group.Point,
    Cz: Group.Point,
    pi: MultProof
): Promise<boolean> {
    const multi = new MultiMult(params.c),
        ok = await aggregateMult(params, Cx, Cy, Cz, pi, multi)
    if (!ok) {
        return false
    }
    return multi.evaluate().isIdentity()
}

export async function aggregateMult(
    params: PedersenParams,
    Cx: Group.Point,
    Cy: Group.Point,
    Cz: Group.Point,
    pi: MultProof,
    multi: MultiMult
): Promise<boolean> {
    const challenge = await hashPoints('SHA-256', [Cx, Cy, Cz, pi.A_x, pi.A_y, pi.A_4_2]),
        cc = params.c.newScalar(challenge),
        A_xrel = new Relation(params.c)
    A_xrel.insertM([params.g, params.h, Cx, pi.A_x.neg()], [pi.t_x, pi.t_rx, cc, params.c.newScalar(BigInt(1))])
    const A_yrel = new Relation(params.c)
    A_yrel.insertM([params.g, params.h, Cy, pi.A_y.neg()], [pi.t_y, pi.t_ry, cc, params.c.newScalar(BigInt(1))])
    const A_4_2rel = new Relation(params.c)
    A_4_2rel.insertM([Cx, params.h, Cz, pi.A_4_2.neg()], [pi.t_y, pi.t_r4, cc, params.c.newScalar(BigInt(1))])

    A_xrel.drain(multi)
    A_yrel.drain(multi)
    A_4_2rel.drain(multi)
    return true
}

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
import { expMod, invMod, posMod, rnd } from '../bignum/big.js'
import { jsonArrayMember, jsonMember, jsonObject, toJson } from 'typedjson'

import { cmpArray } from '../util.js'
import { interpolate } from './interpolate.js'

// Implement Groth-Kohlweiss, "One out of Many Proofs: How to Leak A Secret or Spend a Coin",
// eprint https://eprint.iacr.org/2014/764

@jsonObject
@toJson
export class GKProof {
    @jsonArrayMember(Group.Point, { isRequired: true }) cl: Group.Point[]
    @jsonArrayMember(Group.Point, { isRequired: true }) ca: Group.Point[]
    @jsonArrayMember(Group.Point, { isRequired: true }) cb: Group.Point[]
    @jsonArrayMember(Group.Point, { isRequired: true }) cd: Group.Point[]
    @jsonArrayMember(Group.Scalar, { isRequired: true }) f: Group.Scalar[]
    @jsonArrayMember(Group.Scalar, { isRequired: true }) za: Group.Scalar[]
    @jsonArrayMember(Group.Scalar, { isRequired: true }) zb: Group.Scalar[]
    @jsonMember({ constructor: Group.Scalar, isRequired: true }) zd: Group.Scalar

    constructor(
        cl: Group.Point[],
        ca: Group.Point[],
        cb: Group.Point[],
        cd: Group.Point[],
        f: Group.Scalar[],
        za: Group.Scalar[],
        zb: Group.Scalar[],
        zd: Group.Scalar
    ) {
        this.cl = cl
        this.ca = ca
        this.cb = cb
        this.cd = cd
        this.f = f
        this.za = za
        this.zb = zb
        this.zd = zd
    }

    eq(o: GKProof): boolean {
        return (
            cmpArray(this.cl, o.cl) &&
            cmpArray(this.ca, o.ca) &&
            cmpArray(this.cb, o.cb) &&
            cmpArray(this.cd, o.cd) &&
            cmpArray(this.f, o.f) &&
            cmpArray(this.za, o.za) &&
            cmpArray(this.zb, o.zb) &&
            this.zd.eq(o.zd)
        )
    }
}

function pad(vals: bigint[], c: Group): Group.Scalar[] {
    const ret = []
    for (let i = 0; i < vals.length; i++) {
        ret[i] = c.newScalar(vals[i])
    }
    const padLen = 2 ** Math.ceil(Math.log2(vals.length))
    for (let i = vals.length; i < padLen; i++) {
        ret.push(ret[0])
    }

    return ret
}

function commit(params: PedersenParams, val: bigint, blinder: bigint): Group.Point {
    const posVal = posMod(val, params.c.order),
        posBlinder = posMod(blinder, params.c.order)
    return params.g.dblmul(params.c.newScalar(posVal), params.h, params.c.newScalar(posBlinder))
}

export async function proveMembership(
    params: PedersenParams,
    com: Commitment,
    index: number,
    initialValues: bigint[]
): Promise<GKProof> {
    const values = pad(initialValues, params.c), // Require power of two
        c = params.c,
        el = BigInt(index),
        n = Math.ceil(Math.log2(values.length)),
        eli = []

    let l_tmp = el
    for (let i = 0; i < n; i++) {
        eli[i] = l_tmp % BigInt(2)
        l_tmp /= BigInt(2)
    }

    const ri = [],
        ai = [],
        si = [],
        ti = [],
        rho = []
    for (let i = 0; i < n; i++) {
        ri[i] = rnd(c.order)
        ai[i] = rnd(c.order)
        si[i] = rnd(c.order)
        ti[i] = rnd(c.order)
        rho[i] = rnd(c.order)
    }

    const cl = [],
        ca = [],
        cb = [],
        cd = []
    for (let i = 0; i < n; i++) {
        cl[i] = commit(params, eli[i], ri[i])
        ca[i] = commit(params, ai[i], si[i])
        cb[i] = commit(params, BigInt(eli[i]) * ai[i], ti[i])
    }

    const omegas = []
    for (let i = 0; i < n; i++) {
        omegas[i] = BigInt(i)
    }
    // Compute the values of the d polynomial at the omegas
    const dv = []
    for (const w of omegas) {
        const f0j = [],
            f1j = [],
            ratio = []
        for (let j = 0; j < n; j++) {
            f0j[j] = posMod((BigInt(1) - eli[j]) * w - ai[j], c.order)
            f1j[j] = posMod(eli[j] * w + ai[j], c.order)
            ratio[j] = posMod(f1j[j] * invMod(f0j[j], c.order), c.order)
        }
        let prod = BigInt(1)
        for (let i = 0; i < f0j.length; i++) {
            prod *= f0j[i]
            prod = posMod(prod, c.order)
        }
        const p = []
        p[0] = prod

        for (let i = 0; i < n; i++) {
            const oldlen: number = p.length
            for (let j = 0; j < oldlen; j++) {
                p[oldlen + j] = posMod(BigInt(ratio[i]) * p[j], c.order)
            }
        }

        let dval = BigInt(0)
        for (let i = 0; i < values.length; i++) {
            dval += (values[index].k - values[i].k) * p[i]
            dval = posMod(dval, c.order)
        }
        dv.push(dval)
    }

    const di = interpolate(omegas, dv, c.order)
    for (let i = 0; i < n; i++) {
        cd[i] = commit(params, di[i], rho[i])
    }

    // TODO: hash in the statement as well. Not critical for us as it is server specified.
    const commitments = cl.concat(ca).concat(cb).concat(cd),
        x = await hashPoints('SHA-256', commitments),
        f = [],
        za = [],
        zb = []
    let zd = (com.r.k * expMod(x, BigInt(n), c.order)) % c.order
    for (let i = 0; i < n; i++) {
        f[i] = c.newScalar(posMod(eli[i] * x + ai[i], c.order))
        za[i] = c.newScalar(posMod(ri[i] * x + si[i], c.order))
        zb[i] = c.newScalar(posMod(ri[i] * (x - f[i].k) + ti[i], c.order))
    }
    for (let i = 0; i < n; i++) {
        zd = posMod(zd - rho[i] * expMod(x, BigInt(i), c.order), c.order)
    }

    return new GKProof(cl, ca, cb, cd, f, za, zb, c.newScalar(zd))
}

export async function verifyMembership(
    params: PedersenParams,
    com: Group.Point,
    initVec: bigint[],
    proof: GKProof
): Promise<boolean> {
    const c = params.c,
        multi = new MultiMult(c),
        // First some basic checks
        vec = pad(initVec, c),
        n = Math.ceil(Math.log2(vec.length))
    if (
        n != proof.cl.length ||
        n != proof.ca.length ||
        n != proof.cb.length ||
        n != proof.cd.length ||
        n != proof.f.length ||
        n != proof.za.length ||
        n != proof.zb.length
    ) {
        return false
    }
    const f = proof.f,
        x = await hashPoints('SHA-256', proof.cl.concat(proof.ca).concat(proof.cb).concat(proof.cd))
    multi.addKnown(params.g)
    multi.addKnown(params.h)
    for (let i = 0; i < n; i++) {
        // essentially the bit proof
        const rel0 = new Relation(c)
        rel0.insertM(
            [proof.cl[i], proof.ca[i], params.g, params.h],
            [c.newScalar(x), c.newScalar(BigInt(1)), proof.f[i].neg(), proof.za[i].neg()]
        )
        rel0.drain(multi)
        const rel1 = new Relation(c)
        rel1.insertM(
            [proof.cl[i], proof.cb[i], params.h],
            [c.newScalar(posMod(x - f[i].k, c.order)), c.newScalar(BigInt(1)), proof.zb[i].neg()]
        )
        rel1.drain(multi)
    }

    let total = BigInt(0)
    for (let i = 0; i < vec.length; i++) {
        let pix = BigInt(1)
        for (let j = 0; j < n; j++) {
            if (i & (1 << j)) {
                pix = posMod(pix * f[j].k, c.order)
            } else {
                pix = posMod(pix * (x - f[j].k), c.order)
            }
        }
        total = posMod(total + vec[i].k * pix, c.order)
    }

    const relFinal = new Relation(c)

    for (let i = 0; i < n; i++) {
        relFinal.insert(proof.cd[i as number], c.newScalar(posMod(-expMod(x, BigInt(i), c.order), c.order)))
    }
    relFinal.insert(com, c.newScalar(expMod(x, BigInt(n), c.order)))
    relFinal.insertM([params.g, params.h], [c.newScalar(posMod(-total, c.order)), proof.zd.neg()])
    relFinal.drain(multi)

    return multi.evaluate().isIdentity()
}

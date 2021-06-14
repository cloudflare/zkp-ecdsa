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

import { ExpProof, proveExp, verifyExp } from '../../src/exp/exp.js'
import { p256, tomEdwards256 } from '../../src/curves/instances.js'

import Benchmark from 'benchmark'
import { TypedJSON } from 'typedjson'
import { generatePedersenParams } from '../../src/commit/pedersen.js'
import { rnd } from '../../src/bignum/big.js'

export async function bench(): Promise<Benchmark.Suite> {
    const s = rnd(p256.order),
        P = p256.generator().mul(p256.randomScalar()),
        Q = P.mul(p256.newScalar(s)),
        coordQ = Q.toAffine()
    if (!coordQ) {
        throw new Error('Q is at infinity')
    }
    const secLevel = 80,
        { x, y } = coordQ,
        paramsTom = generatePedersenParams(tomEdwards256),
        Cx = paramsTom.commit(x),
        Cy = paramsTom.commit(y),
        paramsNIST = generatePedersenParams(p256, P),
        Cs = paramsNIST.commit(s),
        proof = await proveExp(paramsNIST, paramsTom, s, Cs, Q, Cx, Cy, secLevel),
        json = TypedJSON.stringifyAsArray(proof, ExpProof)

    console.log('proof size ExpProof:', json.length)
    return new Benchmark.Suite()
        .add(`Exp/prove`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await proveExp(paramsNIST, paramsTom, s, Cs, Q, Cx, Cy, secLevel)
                deferred.resolve()
            },
        })
        .add(`Exp/verify`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await verifyExp(paramsNIST, paramsTom, Cs.p, Cx.p, Cy.p, proof, secLevel)
                deferred.resolve()
            },
        })
}

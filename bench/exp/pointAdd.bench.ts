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

import { PointAddProof, provePointAdd, verifyPointAdd } from '../../src/exp/pointAdd.js'
import { p256, tomEdwards256 } from '../../src/curves/instances.js'

import Benchmark from 'benchmark'
import { generatePedersenParams } from '../../src/commit/pedersen.js'
import { writeJson } from '../../src/serde.js'

export async function bench(): Promise<Benchmark.Suite> {
    const P1 = p256.generator().mul(p256.randomScalar()),
        P2 = p256.generator().mul(p256.randomScalar()),
        P3 = P1.add(P2),
        coordP1 = P1.toAffine(),
        coordP2 = P2.toAffine(),
        coordP3 = P3.toAffine()
    if (!coordP1) {
        throw new Error('P1 is at infinity')
    }
    if (!coordP2) {
        throw new Error('P2 is at infinity')
    }
    if (!coordP3) {
        throw new Error('P3 is at infinity')
    }
    const { x: x1, y: y1 } = coordP1,
        { x: x2, y: y2 } = coordP2,
        { x: x3, y: y3 } = coordP3,
        params = generatePedersenParams(tomEdwards256),
        P1X = params.commit(x1),
        P2X = params.commit(x2),
        P3X = params.commit(x3),
        P1Y = params.commit(y1),
        P2Y = params.commit(y2),
        P3Y = params.commit(y3),
        proof = await provePointAdd(params, P1, P2, P3, P1X, P1Y, P2X, P2Y, P3X, P3Y),
        json = writeJson(PointAddProof, proof)
    console.log('proof size PointAddProof:', json.length)

    return new Benchmark.Suite()
        .add(`PointAdd/prove`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await provePointAdd(params, P1, P2, P3, P1X, P1Y, P2X, P2Y, P3X, P3Y)
                deferred.resolve()
            },
        })
        .add(`PointAdd/verify`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await verifyPointAdd(params, P1X.p, P1Y.p, P2X.p, P2Y.p, P3X.p, P3Y.p, proof)
                deferred.resolve()
            },
        })
}

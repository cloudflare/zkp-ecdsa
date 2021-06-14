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

import { MultProof, proveMult, verifyMult } from '../../src/commit/mult.js'

import Benchmark from 'benchmark'
import { generatePedersenParams } from '../../src/commit/pedersen.js'
import { rnd } from '../../src/bignum/big.js'
import { tomEdwards256 } from '../../src/curves/instances.js'
import { writeJson } from '../../src/serde.js'

export async function bench(): Promise<Benchmark.Suite> {
    const ped = generatePedersenParams(tomEdwards256),
        x = rnd(tomEdwards256.order),
        y = rnd(tomEdwards256.order),
        Cx = ped.commit(x),
        Cy = ped.commit(y),
        z = (x * y) % tomEdwards256.order,
        Cz = ped.commit(z),
        proof = await proveMult(ped, x, y, z, Cx, Cy, Cz),
        json = writeJson(MultProof, proof)
    console.log('proof size MultProof:', json.length)

    return new Benchmark.Suite()
        .add(`Mult/prove`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await proveMult(ped, x, y, z, Cx, Cy, Cz)
                deferred.resolve()
            },
        })
        .add(`Mult/verify`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await verifyMult(ped, Cx.p, Cy.p, Cz.p, proof)
                deferred.resolve()
            },
        })
}

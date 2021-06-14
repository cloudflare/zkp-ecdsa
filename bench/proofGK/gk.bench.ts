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

import { GKProof, proveMembership, verifyMembership } from '../../src/proofGK/gk.js'

import Benchmark from 'benchmark'
import { generatePedersenParams } from '../../src/commit/pedersen.js'
import { tomEdwards256 } from '../../src/curves/instances.js'
import { writeJson } from '../../src/serde.js'

export async function bench(): Promise<Benchmark.Suite> {
    const params = generatePedersenParams(tomEdwards256),
        vec = [BigInt(3), BigInt(5), BigInt(7), BigInt(11), BigInt(13)],
        com = params.commit(BigInt(11)),
        index = 3,
        proof = await proveMembership(params, com, index, vec),
        json = writeJson(GKProof, proof)
    console.log('proof size GK:', json.length)

    return new Benchmark.Suite()
        .add(`GK/prove`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await proveMembership(params, com, index, vec)
                deferred.resolve()
            },
        })
        .add(`GK/verify`, {
            defer: true,
            async fn(deferred: { resolve(): void }) {
                await verifyMembership(params, com.p, vec, proof)
                deferred.resolve()
            },
        })
}

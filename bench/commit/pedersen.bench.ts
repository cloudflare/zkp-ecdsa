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

import Benchmark from 'benchmark'
import { generatePedersenParams } from '../../src/commit/pedersen.js'
import { p256 } from '../../src/curves/instances.js'
import { rnd } from '../../src/bignum/big.js'

export function bench(): Benchmark.Suite {
    const curve = p256,
        x = rnd(curve.order),
        ped = generatePedersenParams(p256)
    return new Benchmark.Suite().add(`Pedersen/commit`, () => {
        ped.commit(x)
    })
}

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

import * as big from '../../src/bignum/big.js'

import Benchmark from 'benchmark'

export function bench(): Benchmark.Suite {
    const p = '0xffffffff0000000100000000000000017e72b42b30e7317793135661b1c4b117',
        p1 = BigInt(p)
    return new Benchmark.Suite().add(`Big/isPrime`, () => {
        big.isPrime(p1)
    })
}

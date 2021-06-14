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

import isomCrypto from 'node-webcrypto-shim'
import { p256 } from '../src/curves/instances.js'

global.crypto = isomCrypto

const NS_PER_SEC = 1e9,
    k = p256.randomScalar()
let p = p256.generator().mul(k)

const testTimes = 1 << 10,
    time = process.hrtime()
for (let i = 0; i < testTimes; i++) {
    p = p.mul(k)
}
const diff = process.hrtime(time)

console.log(`ec/mul: ${(diff[0] * NS_PER_SEC + diff[1]) / testTimes} nanoseconds`)

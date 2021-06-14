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

import { interpolate } from '../../src/proofGK/interpolate.js'

export async function testInterpolate(): Promise<boolean> {
    const res = interpolate([1n, 2n, 3n], [1n, 2n, 3n], 401n),
        expected = [0n, 1n, 0n]
    if (!match(res, expected)) {
        return false
    }
    return true
}

function match(a: bigint[], b: bigint[]) {
    for (let i = 0; i < a.length; i++) {
        if (a[i as number] != b[i as number]) {
            return false
        }
    }
    return true
}

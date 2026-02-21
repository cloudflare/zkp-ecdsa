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

import { Group } from './group.js'
import { TEdwards } from './edwards.js'
import { WeierstrassGroup } from './weier.js'
import { jsonObject } from 'typedjson'

export const p256 = new WeierstrassGroup(
    'p256',
    BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    BigInt('0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc'),
    BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b'),
    BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
    [
        BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
        BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
    ],
)

export const war256 = new WeierstrassGroup(
    'war256',
    BigInt('0xffffffff0000000100000000000000017e72b42b30e7317793135661b1c4b117'),
    BigInt('0xffffffff0000000100000000000000017e72b42b30e7317793135661b1c4b114'),
    BigInt('0xb441071b12f4a0366fb552f8e21ed4ac36b06aceeb354224863e60f20219fc56'),
    BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    [BigInt('0x3'), BigInt('0x5a6dd32df58708e64e97345cbe66600decd9d538a351bb3c30b4954925b1f02d')],
)

// tomEdwards256: ax^2+y^2 = 1 + dx^2y^2
export const tomEdwards256 = new TEdwards(
    'tomEdwards256',
    BigInt('0x3fffffffc000000040000000000000002ae382c7957cc4ff9713c3d82bc47d3af'),
    BigInt('0x1abce3fd8e1d7a21252515332a512e09d4249bd5b1ec35e316c02254fe8cedf5d'),
    BigInt('0x051781d9823abde00ec99295ba542c8b1401874bcbeb9e9c861174c7bca6a02aa'),
    BigInt('0x0ffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    [
        BigInt('0x7907055d0a7d4abc3eafdc25d431d9659fbe007ee2d8ddc4e906206ea9ba4fdb'),
        BigInt('0xbe231cb9f9bf18319c9f081141559b0a33dddccd2221f0464a9cd57081b01a01'),
    ],
)

export const ALL_GROUPS: Array<Group> = [p256, war256, tomEdwards256]

jsonObject({
    initializer: (src: WeierstrassGroup, _raw: WeierstrassGroup): WeierstrassGroup => {
        switch (src.name) {
            case p256.name:
                return p256
            case war256.name:
                return war256
            default:
                throw new Error(`invalid group name: ${src.name}`)
        }
    },
})(WeierstrassGroup)

jsonObject({
    initializer: (src: TEdwards, _raw: TEdwards): TEdwards => {
        if (src.name !== tomEdwards256.name) {
            throw new Error(`invalid group name: ${src.name} `)
        }
        return tomEdwards256
    },
})(TEdwards)

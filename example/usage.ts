/**
 * Copyright 2026 Cloudflare Inc
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

import {
    verifySignatureList,
    generateParamsList,
    proveSignatureList,
    keyToInt,
    writeJson,
    SignatureProofList,
} from '../src/index.js'

async function example() {
    // Message to be signed.
    const plain_msg = 'kilroy was here',
        msg = new TextEncoder().encode(plain_msg)
    console.log(`Message: ${plain_msg}`)

    const // Generate a keypair for signing.
        keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']),
        // Sign a message as usual.
        signature = new Uint8Array(
            await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, msg),
        ),
        // Add the public key to an existing ring of keys,
        listKeys = [BigInt(4), BigInt(5), BigInt(6), BigInt(7), BigInt(8)]
    listKeys.unshift(await keyToInt(keyPair.publicKey))

    // Create a zero-knowledge proof about the signature.
    const params = generateParamsList(),
        msgHash = new Uint8Array(await crypto.subtle.digest('SHA-256', msg)),
        zkAttestProof = await proveSignatureList(
            params,
            msgHash,
            signature,
            keyPair.publicKey,
            0, // position of the public key in the list.
            listKeys,
        ),
        proofJSON = writeJson(SignatureProofList, zkAttestProof)
    console.log(`Proof JSON size: ${proofJSON.length} bytes.`)

    // Verify that zero-knowledge proof is valid.
    const valid = await verifySignatureList(params, msgHash, listKeys, zkAttestProof)
    console.assert(valid == true)
    console.log(`Valid signature: ${valid}`)
}

await example()

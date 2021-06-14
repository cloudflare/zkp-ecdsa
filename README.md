# zkp-ecdsa

![NPM](https://img.shields.io/npm/v/@cloudflare/zkp-ecdsa?style=plastic) ![NPM](https://img.shields.io/npm/l/@cloudflare/zkp-ecdsa?style=plastic)

This is a TypeScript library for Zero-Knowledge proof for ECDSA signatures.

It enables proving knowledge of a ECDSA-P256 signature under one of many
public keys that are stored in a list.

## Installation

[![NPM](https://nodei.co/npm/@cloudflare/zkp-ecdsa.png)](https://www.npmjs.com/package/@cloudflare/zkp-ecdsa)


```sh
 $ npm install @cloudflare/zkp-ecdsa
```

## Usage

First, sign a message using ECDSA (P-256), then create a proof showing that the public key was used to sign the message and that key is in the list, but without revealing which key was used.

```ts
import {
    SignatureProofList, SystemParametersList, generateParamsList, keyToInt,
    proveSignatureList, verifySignatureList,
} from '@cloudflare/zkp-ecdsa'

// Message to be signed.
const msg = new TextEncoder().encode('kilroy was here');

// Generate a keypair for signing.
const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    [ 'sign', 'verify'],
);

// Sign a message as usual.
const msgHash = new Uint8Array(await crypto.subtle.digest('SHA-256', msg));
const signature = new Uint8Array(
    await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey, msg,
    )
);

// Add the public key to the list,
const testPubKey = await keyToInt(keyPair.publicKey);
const listKeys = [
    testPubKey, BigInt(4), BigInt(5), BigInt(6), BigInt(7), BigInt(8),
];

// Create a zero-knowledge proof of the signature.
const params = generateParamsList();
const proof = await proveSignatureList(
    params,
    msgHash,
    signature,
    keyPair.publicKey,
    0,
    listKeys
);

// Verify that zero-knowledge proof is valid.
const valid = await verifySignatureList(params, msgHash, listKeys, proof);
console.assert(valid)
```

---

## Usage

#### Building

```sh
 $ npm ci
 $ npm run build
```

#### Testing

```sh
 $ npm ci
 $ npm run build
 $ npm test
```

---

## Development

#### Benchmark

```sh
 $ npm ci
 $ npm run bench
```

#### Flamegraph

```sh
 $ npm ci
 $ npm run flame
```

#### Webpack

This package compiles to ESModules (instead of CommonJS).
Assumes webpack is installed.

```sh
 $ npm ci
 $ npm run build
 $ webpack --config webpack.config.cjs
```

#### Linter & Formatter

```sh
 $ npm ci
 $ npm run lint
 $ npm run lint:fix
 $ npm run format
```

---

### References

Proof using Groth-Kohlweiss: https://eprint.iacr.org/2014/764

#### Future Work / Possible enhancements
 - Accelerate verification in another language.

---

### License

[Apache 2.0](LICENSE.txt)

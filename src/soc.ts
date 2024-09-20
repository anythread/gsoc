import { Bytes, EthAddress, Signature, SignerFn } from './types'
import { Chunk, Utils } from '@fairdatasociety/bmt-js'
import { hexToBytes, makeHexString, serializeBytes } from './utils'

type Identifier = Bytes<32>

export interface SingleOwnerChunk extends Chunk {
  identifier: () => Identifier
  signature: () => Signature
  owner: () => EthAddress
}

/**
 * Creates a single owner chunk object
 *
 * @param chunk       A chunk object used for the span and payload
 * @param identifier  The identifier of the chunk
 * @param signer      The singer interface for signing the chunk
 */
export async function makeSingleOwnerChunk(
  chunk: Chunk,
  identifier: Identifier,
  signer: SignerFn,
): Promise<SingleOwnerChunk> {
  const chunkAddress = chunk.address()
  const digest = Utils.keccak256Hash(identifier, chunkAddress)
  const signature = await sign(signer, digest)
  const data = serializeBytes(identifier, signature, chunk.span(), chunk.payload)
  const address = makeSOCAddress(identifier, signer.address)

  return {
    ...chunk,
    data: () => data,
    identifier: () => identifier,
    signature: () => signature,
    address: () => address,
    owner: () => signer.address,
  }
}

export function makeSOCAddress(identifier: Identifier, address: EthAddress): Bytes<32> {
  return Utils.keccak256Hash(identifier, address)
}

async function sign(signer: SignerFn, data: Uint8Array): Promise<Signature> {
  const result = await signer.sign(data)

  if (typeof result === 'string') {
    const hexString = makeHexString(result)

    return hexToBytes<65>(hexString)
  }

  if (result instanceof Uint8Array) {
    return result
  }

  throw new TypeError('Invalid output of sign function!')
}

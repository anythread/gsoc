import { gsocSubscribe, SubscriptionHandler, uploadSingleOwnerChunkData } from "./http-client"
import { makeSOCAddress, SingleOwnerChunk } from "./soc"
import { Bytes, Data, Postage, SignerFn } from "./types"
import { bytesToHex, getConsensualPrivateKey, inProximity, keccak256Hash, makeSigner, serializePayload } from "./utils"

export const DEFAULT_RESOURCE_ID = 'any'
const DEFAULT_POSTAGE_BATCH_ID = '0000000000000000000000000000000000000000000000000000000000000000' as Postage
const DEFAULT_CONSENSUS_ID = 'SimpleGraffiti:v1' // used at information signaling

/**
 * InformationSignal is for reading and writing a GSOC topic
 */
export class InformationSignal<UserPayload = InformationSignalRecord> {
  public postageBatchId: Postage
  private beeApiUrl: string
  /** Graffiti Identifier */
  private consensusHash: Bytes<32>
  private assertGraffitiRecord: (unknown: unknown) => asserts unknown is UserPayload

  constructor(beeApiUrl: string, options?: BaseConstructorOptions<UserPayload>) {
    assertBeeUrl(beeApiUrl)
    this.beeApiUrl = beeApiUrl
    this.postageBatchId = options?.postageBatchId ?? DEFAULT_POSTAGE_BATCH_ID
    this.assertGraffitiRecord = options?.consensus?.assertRecord ?? assertInformationSignalRecord
    this.consensusHash = keccak256Hash(options?.consensus?.id ?? DEFAULT_CONSENSUS_ID)
  }

  /**
   * Subscribe to messages for given topic with GSOC
   *
   * **Warning! If connected Bee node is a light node, then it will never receive any message!**
   * This is because light nodes does not fully participate in the data exchange in Swarm network and hence the message won't arrive to them.
   * 
   * @param messageHandler hook function on newly received messages
   * @returns close() function on websocket connection and GSOC address
   */
  subscribe(messageHandler: SubscriptionHandler<UserPayload>, resourceId = DEFAULT_RESOURCE_ID): {
    close: () => void
    gsocAddress: Bytes<32>
   } {
    const graffitiKey = getConsensualPrivateKey(resourceId)
    const graffitiSigner = makeSigner(graffitiKey)
    const gsocAddress = makeSOCAddress(this.consensusHash, graffitiSigner.address)
  
    const insiderHandler = {
      onMessage: (data: Data) => {
        try{
          const json = data.json()
          this.assertGraffitiRecord(json)
          messageHandler.onMessage(json)
        } catch(e) {
          messageHandler.onError(e as Error)
        }
      },
      onError: messageHandler.onError
    }
    const close = gsocSubscribe(
      this.beeApiUrl,
      bytesToHex(gsocAddress),
      insiderHandler
    )

    return {
      close,
      gsocAddress,
    }
  }

  /**
   * Write GSOC and upload to the Swarm network
   * 
   * @param data GSOC payload
   * @param resourceID the common topic for the GSOC records. It can be a hex string without 0x prefix to have it without conversation.
   */
  write(data: UserPayload, resourceId = DEFAULT_RESOURCE_ID): Promise<SingleOwnerChunk> {
    this.assertGraffitiRecord(data)
    const graffitiKey = getConsensualPrivateKey(resourceId)
    const graffitiSigner = makeSigner(graffitiKey) 

    return uploadSingleOwnerChunkData(
      { baseURL: this.beeApiUrl },
      this.postageBatchId,
      graffitiSigner,
      this.consensusHash,
      serializePayload(data),
    )
  }

  /**
   * Mine the resource ID respect to the given address of Bee node and storage depth
   * so that the GSOC will fall within the neighborhood of the Bee node.
   * 
   * @param beeAddress Bee node 32 bytes address
   * @param storageDepth the depth of the storage on Swarm network
   * @returns mined resource ID and GSOC address
   */
  mineResourceID(beeAddress: Uint8Array, storageDepth: number): { resourceId: Bytes<32>, gsocAddress: Bytes<32> } {
    if (storageDepth > 32) {
      throw new Error('Storage depth cannot be greater than 32!')
    }
    if (beeAddress.length !== 32) {
      throw new Error('Bee address has to be 32 bytes!')
    }

    const resourceId: Bytes<32> = new Uint8Array(32) as Bytes<32>
    let graffitiSigner: SignerFn
    let gsocAddress: Bytes<32>
    do {
      // increment array resourceID by one
      for (let i = 0; i < resourceId.length; i++) {
        if (resourceId[i] === 255) {
          resourceId[i] = 0
        } else {
          resourceId[i]++
          break
        }
      }

      graffitiSigner = makeSigner(resourceId)
      gsocAddress = makeSOCAddress(this.consensusHash, graffitiSigner.address)
    } while (!inProximity(beeAddress, gsocAddress, storageDepth))

    return { resourceId, gsocAddress: gsocAddress }
  }
}

/**
 * Validates that passed string is valid URL of Bee, if not it throws BeeArgumentError.
 * We support only HTTP and HTTPS protocols.
 * @param url
 * @throws BeeArgumentError if non valid URL
 */
function assertBeeUrl(url: unknown): asserts url is URL {
  if (!isValidBeeUrl(url)) {
    throw new Error('URL is not valid!')
  }
}

/**
 * Validates that passed string is valid URL of Bee.
 * We support only HTTP and HTTPS protocols.
 *
 * @param url
 */
function isValidBeeUrl(url: unknown): url is URL {
  try {
    if (typeof url !== 'string') {
      return false
    }

    const urlObject = new URL(url)

    // There can be wide range of protocols passed.
    return urlObject.protocol === 'http:' || urlObject.protocol === 'https:'
  } catch (e) {
    // URL constructor throws TypeError if not valid URL
    if (e instanceof TypeError || (e as any).code !== null && (e as any).code === 'ERR_INVALID_URL') {
      return false
    }

    throw e
  }
}

type InformationSignalRecord = string

function isInformationSignalRecord(value: unknown): value is InformationSignalRecord {
  return value !== null && typeof value === 'string'
}

function assertInformationSignalRecord(value: unknown): asserts value is InformationSignalRecord {
  if (!isInformationSignalRecord(value)) {
    throw new Error('Value is not a valid Graffiti Feed Record')
  }
}

interface BaseConstructorOptions<T = InformationSignalRecord> {
  consensus?: {
    /**
     * The used consensus identifier of the GraffitiFeed
     * Default: AnyThread:v1
     */
    id: string
    /**
     * Assertion function that throws an error if the parameter
     * does not satisfy the structural requirements.
     * record formats:
     * - PersonalStorageSignal: record in the personal storage.
     * - InformationSignal: record in the graffiti feed.
     * Default: assertAnyThreadComment
     * @param unknown any object for asserting
     */
    assertRecord: (unknown: unknown) => asserts unknown is T
  }
  /**
   * Swarm Postage Batch ID which is only required when write happens
   * Default: 000000000000000000000000000000000000000000000
   */
  postageBatchId?: Postage
  /**
   * API Url of the Ethereum Swarm Bee client
   * Default: http://localhost:1633
   */
  beeApiUrl?: string
}

import { beePeerUrl, beeUrl, getPostageBatch } from '../jest.config'
import { InformationSignal } from '../src'
import { getNodeAddresses } from '../src/http-client'

const BEE_URL = beeUrl()
const BEE_PEER_URL = beePeerUrl()

const getGsocInstance = (beeUrl: string, postageBatchId?: string): InformationSignal => {
  postageBatchId ||= getPostageBatch(beeUrl)
  const gsoc = new InformationSignal(beeUrl, {
    postage: postageBatchId,
  })

  return gsoc
}

describe('gsoc', () => {
  const gsoc = getGsocInstance(BEE_URL)
  const gsoc2 = getGsocInstance(BEE_URL, getPostageBatch(BEE_URL, 1))
  const gsocPeer = new InformationSignal(BEE_PEER_URL)

  it('send messages with different postage batches sequentially', async () => {
    const beePeerOverlay = await getNodeAddresses({ baseURL: BEE_PEER_URL })
    const { resourceId, gsocAddress } = gsoc.mineResourceId(beePeerOverlay.overlay, 11)

    const messages: string[] = []

    const { close, gsocAddress: listenGsocAddress } = gsocPeer.listen(
      {
        onMessage: message => {
          messages.push(message)
        },
        onError: error => {
          throw error
        },
      },
      resourceId,
    )

    expect(listenGsocAddress).toStrictEqual(gsocAddress)

    await gsoc.send('message 1', resourceId)
    await gsoc.send('message 2', resourceId)
    await gsoc2.send('message 3', resourceId)
    await gsoc.send('message 4', resourceId)
    await gsoc2.send('message 5', resourceId)
    await gsoc2.send('message 6', resourceId)
    await gsoc.send('message 7', resourceId)

    await waitGsocArrive(1000)

    close()

    expect(messages).toEqual([
      'message 1',
      'message 2',
      'message 3',
      'message 4',
      'message 5',
      'message 6',
      'message 7',
    ])
  })

  it('send messages with different postage batches parallel', async () => {
    const resourceId = 'test2'

    const messages: string[] = []

    const { close } = gsocPeer.listen(
      {
        onMessage: message => {
          messages.push(message)
        },
        onError: error => {
          throw error
        },
      },
      resourceId,
    )

    await Promise.all([
      gsoc.send('message 1', resourceId),
      gsoc.send('message 2', resourceId),
      gsoc2.send('message 3', resourceId),
      gsoc.send('message 4', resourceId),
      gsoc2.send('message 5', resourceId),
      gsoc2.send('message 6', resourceId),
      gsoc.send('message 7', resourceId),
    ])

    await waitGsocArrive(1000)

    close()

    // two different postage batches with two updates (new GSOC postage timestamp can be smaller than the previous GSOC's timestamp)
    expect(messages.sort()).toEqual([
      'message 1',
      'message 2',
      'message 3',
      'message 4',
      'message 5',
      'message 6',
      'message 7',
    ])
  })
})

// awaits for the gsoc message to be synced on test node
async function waitGsocArrive(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

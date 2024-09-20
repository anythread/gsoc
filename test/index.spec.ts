import { beePeerUrl, beeUrl, getPostageBatch } from '../jest.config'
import { InformationSignal } from '../src'
import { getNodeAddresses } from '../src/http-client'

const BEE_URL = beeUrl()
const BEE_PEER_URL = beePeerUrl()

const getGsocInstance = (beeUrl: string, postageBatchId?: string): InformationSignal => {
  postageBatchId ||= getPostageBatch(beeUrl)
  const gsoc = new InformationSignal(beeUrl, {
    postageBatchId: postageBatchId,
  })

  return gsoc
}

describe('gsoc', () => {
  const gsoc = getGsocInstance(BEE_URL)
  const gsoc2 = getGsocInstance(BEE_URL, getPostageBatch(BEE_URL, 1))
  const gsocPeer = getGsocInstance(BEE_PEER_URL)

  it('send message with different postage batches', async () => {
    const beePeerOverlay = await getNodeAddresses({ baseURL: BEE_PEER_URL })
    const { resourceId, gsocAddress } = gsoc.mineResourceId(beePeerOverlay.overlay, 2)

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
})

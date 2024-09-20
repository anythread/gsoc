# GSOC

This library facilitates to use [Graffiti Several Owner Chunks (GSOC)](https://github.com/nugaon/SWIPs/blob/graffiti-soc/SWIPs/swip-draft_graffiti-soc.md) on [Ethereum Swarm](https://www.ethswarm.org/).

Leveraging its features, any data can be referenced to other related data without maintaing any external registry or running service.

** WARNING! This project is in the experimental phase! **

It is intended to be an upgraded version of the predecessor Graffiti Feed based [zerodash library](https://github.com/anythread/zerodash).
Missing feature is the reading part though the communication is possible by running storer node and subscribe to incoming infromation signals.

# Install

** NPM release will be available later, [compile](#Compilation) the project instead! **
```sh
npm install @anythread/gsoc --save
```

# Usage

The library provides `InformationSignal` class that reads/writes GSOC according to the consensus and other configuration parameters.

The consensus consists of an arbitrary `id` and an assert function that validates the handled records in the GSOC address space.
```ts
const id = 'SampleDapp:v1'

export interface SampleDappRecord {
  /** text of the message */
  text: string
  /** creation time of the comment */
  timestamp: number
}

function assertRecord(value: unknown): asserts value is SampleDappRecord {
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).includes('text') &&
    Object.keys(value).includes('timestamp')
  ) {
    return
  }
  
  throw new Error('The given value is not a valid personal storage record')
}
```

With that, the rules have been created for kademlia information signaling on any data.

## Information Signal

Information Signal class facilitates GSOC data reading based on the passed consensus rules.

```ts
import { InformationSignal } from '@anythread/gsoc'

beeUrl = 'http://localhost:1633' // Bee API URL to connect p2p storage network
postageBatchId = '0000000000000000000000000000000000000000000000000000000000000000' // for write operations, the Postage Batch ID must be set.
resourceId = 'demo' // any string/content hash that represents the resource to which the Personal Storage record will be associated.

// initialize object that will read and write the GSOC according to the passed consensus/configuration
const informationSignal = new InformationSignal(beeUrl, {
  postageBatchId,
  consensus: {
    id,
    assertRecord,
  },
})

// it is also possible to mine the resourceId to the desired Bee node to ensure they will get the message as soon as possible on the forwarding Kademlia network
targetBeeOverlayAddress = 'b0baf37700000000000000000000000000000000000000000000000000000000'
{ resourceId } = informationSignal.mine(targetBeeOverlayAddress, 16)

// subscribe to incoming topics on the receiver node
// this will immediately invoge `onMessage` and `onError` function if the message arrives to the target neighborhood of the Kademlia network.
cancelSub = informationSignal.subscribe({onMessage: msg => console.log('my-life-event', msg), onError: console.log}, resourceId)

// write GSOC record that satisfies the message format with the `write` method.
uploadedSoc = await informationSignal.write({ text: 'Hello there!', timestamp: 1721989685349 }, resourceId)
```

# Compilation

In order to compile code run

```sh
npm run compile
```

You can find the resulted code under the `dist` folder.

For types compilation, run

```sh
npm run compile:types
```

# Testing

The testing needs running Bee client node for integration testing.
You should set `BEE_POSTAGE` and `BEE_POSTAGE_2` environment variable with valid Postage batch IDs.

In order to test on different node than `http://localhost:1633` and `http://localhost:11633`, set `BEE_API_URL` and `BEE_PEER_API_URL` environment variable, respectively.

To run test execute

```sh
npm run test
```

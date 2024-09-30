/* eslint-disable no-console */
/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */
import type { Config } from '@jest/types'
import { BeeRequestOptions, createPostageBatch } from './src/http-client'

const DEFAULT_BATCH_AMOUNT = '600000000'

/**
 * Returns a url for testing the Bee public API
 */
export function beeUrl(): string {
  return process.env.BEE_API_URL || 'http://127.0.0.1:1633'
}

/**
 * Returns a url of another peer for testing the Bee public API
 */
export function beePeerUrl(): string {
  return process.env.BEE_PEER_API_URL || 'http://127.0.0.1:11633'
}

type BatchId = string

/**
 * Helper function that create monster batch for all the tests.
 * There is semaphore mechanism that allows only creation of one batch across all the
 * parallel running tests that have to wait until it is created.
 */
export function getPostageBatch(url = beeUrl(), index?: number): BatchId {
  let stamp: BatchId

  switch (url) {
    case beeUrl():
      stamp = process.env.BEE_POSTAGE as BatchId
      if (index === 1) {
        stamp = process.env.BEE_POSTAGE_2 as BatchId
      }
      break
    case beePeerUrl():
      stamp = process.env.BEE_PEER_POSTAGE as BatchId
      break
    default:
      throw new Error('Unknown URL ' + url)
  }

  if (!stamp) {
    throw new Error('There is no postage stamp configured for URL ' + url)
  }

  return stamp
}

export default async (): Promise<Config.InitialOptions> => {
  try {
    const beeRequestOptions: BeeRequestOptions = {
      baseURL: beeUrl(),
    }

    if (!process.env.BEE_POSTAGE || !process.env.BEE_POSTAGE_2) {
      console.log('Creating postage stamps since BEE_POSTAGE or BEE_POSTAGE_2 is not set...')

      const stampsOrder: { requestOptions: BeeRequestOptions; env: string }[] = []

      if (!process.env.BEE_POSTAGE) {
        stampsOrder.push({ requestOptions: beeRequestOptions, env: 'BEE_POSTAGE' })
      }

      if (!process.env.BEE_POSTAGE_2) {
        stampsOrder.push({ requestOptions: beeRequestOptions, env: 'BEE_POSTAGE_2' })
      }

      for (const order of stampsOrder) {
        const stamp = await createPostageBatch(order.requestOptions, DEFAULT_BATCH_AMOUNT, 20, {
          waitForUsable: true,
        })
        // set env
        process.env[order.env] = stamp
        console.log(`export ${order.env}=${stamp}`)
      }
    }
  } catch (e) {
    // It is possible that for unit tests the Bee nodes does not run
    // so we are only logging errors and not leaving them to propagate
    console.error(e)
  }

  return {
    // Indicates whether the coverage information should be collected while executing the test
    // collectCoverage: false,

    // The directory where Jest should output its coverage files
    coverageDirectory: 'coverage',

    // An array of regexp pattern strings used to skip coverage collection
    coveragePathIgnorePatterns: ['/node_modules/'],

    // An array of directory names to be searched recursively up from the requiring module's location
    moduleDirectories: ['node_modules'],

    // Run tests from one or more projects
    projects: [
      {
        preset: 'ts-jest',
        displayName: 'node',
        testEnvironment: 'node',
        testRegex: 'test/.*\\.spec\\.ts',
      },
    ] as unknown[] as string[], // bad types

    // The root directory that Jest should scan for tests and modules within
    rootDir: 'test',

    // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
    testPathIgnorePatterns: ['/node_modules/'],

    // Increase timeout since we have long running cryptographic functions
    testTimeout: 4 * 60 * 1000,
  }
}

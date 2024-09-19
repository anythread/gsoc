/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */
import type { Config } from '@jest/types'
import { BeeRequestOptions, createPostageBatch } from './src/http-client'

const DEFAULT_BATCH_AMOUNT = '600000000'

export default async (): Promise<Config.InitialOptions> => {
  try {
    const beeRequestOptions: BeeRequestOptions = {
      baseURL: process.env.BEE_API_URL || 'http://127.0.0.1:1633/',
    }
    const beePeerRequestOptions: BeeRequestOptions = {
      baseURL: process.env.BEE_PEER_API_URL || 'http://127.0.0.1:11633/',
    }

    if (!process.env.BEE_POSTAGE || !process.env.BEE_PEER_POSTAGE) {
      console.log('Creating postage stamps since BEE_POSTAGE or BEE_PEER_POSTAGE is not set...')

      const stampsOrder: { requestOptions: BeeRequestOptions; env: string }[] = []

      if (!process.env.BEE_POSTAGE) {
        stampsOrder.push({ requestOptions: beeRequestOptions, env: 'BEE_POSTAGE' })
      }

      if (!process.env.BEE_PEER_POSTAGE) {
        stampsOrder.push({ requestOptions: beePeerRequestOptions, env: 'BEE_PEER_POSTAGE' })
      }

      const stamps = await Promise.all(
        stampsOrder.map(async order =>
          createPostageBatch(order.requestOptions, DEFAULT_BATCH_AMOUNT, 20, {
            waitForUsable: true,
          }),
        ),
      )

      for (let i = 0; i < stamps.length; i++) {
        process.env[stampsOrder[i].env] = stamps[i]
        console.log(`export ${stampsOrder[i].env}=${stamps[i]}`)
      }

      console.log('Waiting for the stamps to be usable')
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
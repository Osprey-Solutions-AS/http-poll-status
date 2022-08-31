const core = require('@actions/core');
const axios = require('axios');
const https = require('https');
const { request, METHOD_POST } = require('./httpClient');
const { GithubActions } = require('./githubActions');
const { match, rejects } = require('assert');
const { maybe } = require('./maybe')

let auth = undefined
let customHeaders = {}
const actions = new GithubActions()

const retries = core.getInput('retries') || 5
const retryTimeout = core.getInput('retry_timeout') || 5
const matchKey = core.getInput('match_key')
const matchValue = core.getInput('match_value')

if (!!core.getInput('customHeaders')) {
  try {
    customHeaders = JSON.parse(core.getInput('customHeaders'));
  } catch(error) {
    core.error('Could not parse customHeaders string value')
  }
}

const headers = { 'Content-Type': core.getInput('contentType') || 'application/json' }

if (!!core.getInput('bearerToken')) {
  headers['Authorization'] = `Bearer ${core.getInput('bearerToken')}`;
}

/** @type {axios.AxiosRequestConfig} */
const instanceConfig = {
  baseURL: core.getInput('url', { required: true }),
  timeout: parseInt(core.getInput('timeout') || 5000, 10),
  headers: { ...headers, ...customHeaders }
}

if (!!core.getInput('httpsCA')) {
  instanceConfig.httpsAgent = new https.Agent({ ca: core.getInput('httpsCA') })
}

if (!!core.getInput('username') || !!core.getInput('password')) {
  core.debug('Add BasicHTTP Auth config')

  instanceConfig.auth = {
    username: core.getInput('username'),
    password: core.getInput('password')
  }
}

const data = core.getInput('data') || '{}';
const files = core.getInput('files') || '{}';
const file = core.getInput('file')
const method = core.getInput('method') || METHOD_POST;
const preventFailureOnNoResponse = core.getInput('preventFailureOnNoResponse') === 'true';
const escapeData = core.getInput('escapeData') === 'true';

const ignoreStatusCodes = core.getInput('ignoreStatusCodes')
let ignoredCodes = []

if (typeof ignoreStatusCodes === 'string' && ignoreStatusCodes.length > 0) {
  ignoredCodes = ignoreStatusCodes.split(',').map(statusCode => parseInt(statusCode.trim()))
}

const client = axios.create(instanceConfig)

const timeout = async function(timeout) {
  return new Promise((resolve) => {
      setTimeout(() => resolve(1), timeout)
  })
}

const check = async function(i) {
  return new Promise(async (resolve, reject) => {
    const response = await request({ data, method, instanceConfig, preventFailureOnNoResponse, escapeData, files, file, ignoredCodes, actions })
    //const response = await client.get()
    const result = maybe(response, ...matchKey.split('.'))
    if (result == matchValue) {
      actions.setOutput('result', result)
      return resolve(result)
    }
    if (i >= retries) {
      return reject({message: 'max retries'})
    }
    await timeout(retryTimeout * 1000)

    return Promise.resolve(check(i+1)).catch(error => actions.setFailed({ message: `Polling failed: ${error.message}`}))
  })
}

const main = async function() {
  try {
    await check(1)
  } catch(e) {
  }
}

main()
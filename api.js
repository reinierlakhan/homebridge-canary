let Cookie = require('tough-cookie').Cookie
let request = require('request-promise-native')
let memoize = require('memoizee')

let Api = function (log, username, password) {
  this.log = log
  this.username = username
  this.password = password

  // Memoize methods
  this.sessionToken = memoize(
    this.sessionToken.bind(this),
    {
      promise: true,
      maxAge: 14 * 24 * 60 * 60 * 1000 /* 14 days */
    })

  this.readings = memoize(
    this.readings.bind(this),
    {
      promise: true,
      maxAge: 5 * 60 * 1000 /* 5 minutes */
    })

  this.locations = memoize(
    this.locations.bind(this),
    {
      promise: true,
      maxAge: 60 * 60 * 1000 /* 1 hour */
    })
}

Api.prototype.sessionToken = async function () {
  let req = request.defaults({
    // Enable cookie jar for XSRF token cookie
    jar: true,

    // Resolve with full response so we can read headers
    resolveWithFullResponse: true
  })

  this.log('Setting up new Canary session')

  let response = await req.get(this.endpoint('/login'))
  let cookies = response.headers['set-cookie']

  // Find the XSRF token
  let xsrfToken
  for (var i in cookies) {
    let cookie = Cookie.parse(cookies[i])
    if (cookie && cookie.key === 'XSRF-TOKEN') {
      xsrfToken = cookie.value
    }
  }

  if (!xsrfToken) {
    return Promise.reject(new Error('Unable to log in, no XSRF token found?'))
  }

  response = await req.post({
    json: true,
    uri: this.endpoint('/api/auth/login'),
    headers: {
      'X-XSRF-TOKEN': xsrfToken
    },
    body: {
      username: this.username,
      password: this.password
    }
  })

  let token = response.body['token']
  if (!token) {
    return Promise.reject(new Error('Unable to log in, no session token found?'))
  }

  this.log('Sucessfully established Canary session')

  return Promise.resolve(token)
}

Api.prototype.locations = async function () {
  return this.fetch('/api/locations')
}

Api.prototype.devices = async function () {
  let locations = await this.locations()
  let devices = []

  locations.forEach(l => devices.push(...l.devices))

  return Promise.resolve(devices)
}

Api.prototype.readings = async function (deviceId, model) {
  let canaryType = 'canary'
  if (model.toLowerCase() === 'flex') {
    canaryType = 'flex'
  }

  return this.fetch(`/api/readings?deviceId=${deviceId}&type=${canaryType}`)
}

Api.prototype.fetch = async function (path) {
  let session = await this.sessionToken()

  return request.get({
    json: true,
    uri: this.endpoint(path),
    headers: {
      'Authorization': 'Bearer ' + session
    }
  })
}

Api.prototype.endpoint = function (path) {
  return 'https://my.canary.is' + path
}

module.exports = {
  Api: Api
}

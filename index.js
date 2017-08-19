var fs = require('fs')
var readline = require('readline')
var google = require('googleapis')
var GoogleAuth = require('google-auth-library')

var SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/'
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json'

var sheets = google.sheets('v4')

let auth = null

// Load client secrets
fs.readFile('client_secret.json', function processClientSecrets (err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err)
    return
  }
  // Authorize a client, then call setup
  authorize(JSON.parse(content), setup)
})

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize (credentials, callback) {
  var clientSecret = credentials.installed.client_secret
  var clientId = credentials.installed.client_id
  var redirectUrl = credentials.installed.redirect_uris[0]
  var gAuth = new GoogleAuth()
  var oauth2Client = new gAuth.OAuth2(clientId, clientSecret, redirectUrl)

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback)
    } else {
      oauth2Client.credentials = JSON.parse(token)
      auth = oauth2Client
      callback()
    }
  })
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken (oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  })
  console.log('Authorize this app by visiting this url: ', authUrl)
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close()
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err)
        return
      }
      oauth2Client.credentials = token
      storeToken(token)
      auth = oauth2Client
      callback()
    })
  })
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken (token) {
  try {
    fs.mkdirSync(TOKEN_DIR)
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token))
  console.log('Token stored to ' + TOKEN_PATH)
}

function setup () {
  fs.readFile('config.json', function (err, config) {
    if (err) {
      let config = {}
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.question('Enter spreadsheet ID: ', function (code) {
        config.spreadsheetId = code
        rl.question('Enter sheet title or leave blank to get all sheets: ', function (code) {
          config.range = code ? [code] : []
          rl.question('Enter path to store exported JSON: ', function (code) {
            config.path = code
            rl.question('Save configuration? (Y/n): ', function (code) {
              rl.close()
              getAvailableSheets(config)
              if (code.toUpperCase() !== 'N' && code.toUpperCase() !== 'NO') {
                fs.writeFile('config.json', JSON.stringify(config))
                console.log('config stored to config.json')
              }
            })
          })
        })
      })
    } else {
      getAvailableSheets(JSON.parse(config))
    }
  })
}

function getAvailableSheets (config) {
  if (config.range.length > 0) {
    getSheet(config)
    return
  }

  sheets.spreadsheets.get({
    auth,
    spreadsheetId: config.spreadsheetId,
    includeGridData: false
  }, function (err, resp) {
    if (err) {
      console.log('The API returned an error: ' + err)
      return
    }
    config.range = resp.sheets.filter(s => s.properties.hidden !== true).map(s => s.properties.title)
    getSheet(config)
  })
}

function getSheet (config) {
  sheets.spreadsheets.values.batchGet({
    auth: auth,
    spreadsheetId: config.spreadsheetId,
    ranges: config.range
  }, function (err, response) {
    if (err) {
      console.log('The API returned an error: ' + err)
      return
    }
    let output = {}
    // console.log(response)
    response.valueRanges.forEach((vr, i) => {
      let sheet = config.range[i]
      let keys = vr.values[0]
      let values = vr.values.filter((vals, i) => i > 0).map(vals => {
        let obj = {}
        vals.forEach((v, i) => {
          if (keys[i] != null) {
            obj[keys[i]] = v
          }
        })
        return obj
      })
      output[sheet] = values
    })

    fs.writeFileSync(config.path, JSON.stringify(output))
  })
}

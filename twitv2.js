'use strict';

/**
 * Module dependencies.
 */
const
    request     = require('request'),
    feedParser  = require('feedparser-promised'),
    google      = require('googleapis'),
    googleAuth  = require('google-auth-library'),
    fs          = require('fs'),
    conf        = require('./conf.json'),
    Twitter     = require('simple-twitter'),
    readline = require('readline')

var filterList = []
require('events').EventEmitter.prototype._maxListeners = 100;


let twitter = new Twitter(
    conf.key, //consumer key from twitter api
    conf.secret, //consumer secret key from twitter api
    conf.token, //acces token from twitter api
    conf.tokenSecret, //access token secret from twitter api
    3600  //(optional) time in seconds in which file should be cached (only for get requests), put false for no caching
);

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}


// Create a simple server
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('FintechBot\n');
}).listen(8999);

// Set timeout to loop the whole thing every 10 minutes
//var timerVar = setInterval (function () {runBot()}, 6000);

var wrapme = function() {
    fs.readFile('./client_secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Sheets API.
        authorize(JSON.parse(content), runBot);
    });
}

wrapme()
setInterval(wrapme, 900000)

function runBot(auth) {
    let filteredURLS = []
    let unfilteredURLS = []
    let checkFilter
    var sheets = google.sheets('v4');

    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: 'google spreadsheetID goes here',
        range: 'filters!A1:B'
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var rows = response.values;
        if (rows.length === 0) {
            console.log('No data found.');
        } else {
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                filterList.push(row)
            }
        }
    });
    sheets.spreadsheets.values.get({
        auth: auth,
        //spreadsheetId: '1xJ_bXWG8hoZqIO5hcJxxYlyxLNSOSKSEuJRueYpna9Q',
        spreadsheetId: '13a41ojICmjaf8bOpLABtvQuUt8lbavYldWEteBkehvg',
        range: 'FintechTest!A2:E'
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var rows = response.values;
        if (rows.length === 0) {
            console.log('No data found.');
        } else {
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var theUrl = row[1]
                if (row[4]) {
                    var twitAuth = row[4]
                }
                if (row[3] === 'Yes') {
                    checkFilter = 'yes'
                        feedme(theUrl, checkFilter, twitAuth)
                    checkFilter = ''
                }
                else {
                    checkFilter = 'no'
                        feedme(theUrl, checkFilter, twitAuth)
                    }
                checkFilter = ''
            }

        }
    })
}

function feedme(url, filterFlag, twitAuth) {

    feedParser.parse(url).then((items) => {
        items.forEach(item => {
            //  console.log(url)
            // Get the date and time right now
            var dateNow = new Date();

            // Get the date 11 minutes ago (roughly the last time the bot finished running)
            // Now an 15 mins (900000) + 1min (60000) = 960000
            var lastRun = dateNow - 960000;
            // Get the date 12 hours ago
            var twelveHours = dateNow - 43200000;
            // Get the date 12 hours and 10 minutes ago
            var twelveHoursTen = dateNow - 43296000;
            let dateYPTconv = new Date(twelveHoursTen).toISOString();
            let lastRunConv =  new Date(lastRun).toISOString();
            let dateYdayConv = new Date(twelveHours).toISOString()

            lastRunConv = new Date(lastRunConv)

            dateYdayConv = new Date(dateYdayConv)

            let testitemdate = new Date(item.date)
            dateYPTconv = new Date(dateYPTconv)
            let continueFlag

        //    console.log('item date, yesterday, 12hours+10, last run ', item.date , ' - ', dateYPTconv, ' - ', dateYdayConv, ' - ' , lastRunConv)

            // Ensure we only try to post things published between 12 hours and 12 hours 10 minutes ago
            if ((item.date > dateYPTconv && item.date < dateYdayConv) || item.date > lastRunConv) {
              //  console.log("item date, a day ago, ")
               // console.log(item.date, dateYPTconv, dateYdayConv2, lastConv2)
                // Here we are ensuring that long post titles don't lose the link in the tweet.
                let titleLength = item.title.length;
            //    console.log(filterFlag)
                if (filterFlag === 'yes') {
             //       console.log("i'm in the filtered list, url, filterflag ", url, filterFlag)

                    let length = filterList.length;

                    while (length--) {
                        let intra = item.title;
                        if (intra.indexOf('(') > -1){
                            break
                        }
                        if (intra.indexOf(filterList[length]) !== -1) {
                            let itemTitle = item.title

                            if (titleLength < 90) {
                                createTweet(itemTitle, item.link, twitAuth)
                            //    console.log(url, ' ' ,itemTitle, item.link, twitAuth)
                                break
                            } else {
                                let itemTitle = itemTitle.substring(0, 90);
                                createTweet(itemTitle, item.link, twitAuth)
                       //         console.log(url, ' ' , itemTitle, item.link, twitAuth)
                                break
                            }
                        }
                    }
                }
                else {
                   // console.log("am i in the unfiltered list? - url, flag ", url, filterFlag)
                    let itemTitle = item.title;
                    if (itemTitle.indexOf('(') > -1){
                        continueFlag = 0
                    }

                    if (continueFlag = 1){
                        if (titleLength < 90) {
                           createTweet(itemTitle, item.link, twitAuth)
                          //  console.log(itemTitle, filterFlag, item.link, twitAuth)
                        } else {
                            itemTitle = itemTitle.substring(0, 90);
                            createTweet(itemTitle, item.link, twitAuth)
                           //console.log(itemTitle,filterFlag, item.link, twitAuth)
                        }
                    }
                }
            }
        })
        }).catch(error => console.error('error on : ', url, ' err is : ',  error));
}

function createTweet(title, link, author){
    let message
    if (author !==null){
        message = title + ' ' + link + ' by ' + author
    }
    else {
        message = title + ' ' + link
    }
   // console.log(message)
    twitter.post('statuses/update',
        // {'status': title + ' - ' + link + ' by ' + author},
        {'status': message},
        // deal with any twitter errors
        function (error, data) {
            console.dir(data);
        }
    );

}

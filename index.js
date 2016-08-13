'use strict';
var http = require('http'),
    DartsConnectClient = require(__dirname + '/DartsConnectClient.class.js');



const DART_SERVER_HOST = 'localhost',
    DART_SERVER_PORT = 3000;

var client = new DartsConnectClient({log: false});
client.connect('192.168.1.109', {callback: (event) => {
  var throwData = null;
  switch(event.type) {
    case 'throw':
      let data = event.data.toLocaleLowerCase(),
          type = data.substr(0, 1),
          number = data.substr(1);

      switch(type) {
        case 'd':
          type = 'DOUBLE';
          break;

        case 'o':
          type = 'SINGLE_OUTER';
          break;

        case 't':
          type = 'TRIPLE';
          break;

        case 'i':
          type = 'SINGLE_INNER';
          break;
      }
      throwData = {type: type, number: ('b' === number ? 21 : parseInt(number))};
      break;

    case 'next':
      throwData = {type: 'MISS', number: 0};
      break;

    case 'connected':
      console.log(' -connected');
      break;

    case 'pinged':
      console.log(' -pinged');
      break;

    default:
      break;
  }

  if (null !== throwData) {
    // submit here
    console.log('send:', throwData);
    post_to_dart_server(throwData);
  }
}});



function post_to_dart_server(data) {
  var encoded = JSON.stringify(data),
      req = http.request({
        host: DART_SERVER_HOST,
        port: DART_SERVER_PORT,
        path: '/api/throw',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(encoded)
        }
      }, (res) => {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log("body: " + chunk);
        });
      });

  req.write(encoded);
  req.end();
}
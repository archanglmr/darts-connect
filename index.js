'use strict';
var http = require('http'),
    DartsConnectClient = require(__dirname + '/DartsConnectClient.class.js');



const DART_GAME_SERVER_HOST = 'localhost',
    DART_GAME_SERVER_PORT = 3000,
    DARTS_CONNECT_BOARD = '192.168.1.135';

var client = new DartsConnectClient({log: false});
client.connect(DARTS_CONNECT_BOARD, {callback: (event) => {
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
      console.log('dartboard: throw');
      break;

    case 'next':
      throwData = {type: 'MISS', number: 0};
      console.log('dartboard: next');
      break;

    case 'connected':
      console.log('dartboard: connected');
      break;

    case 'pinged':
      console.log('dartboard: pinged');
      break;

    default:
      console.log(`dartboard: ${event.type}`);
      if (event.data) {
        console.log(event.data);
      }
      break;
  }

  if (null !== throwData) {
    // submit here
    console.log('send to game:', throwData);
    post_to_dart_server(throwData);
  }
}});



function post_to_dart_server(data) {
  var encoded = JSON.stringify(data),
      req = http.request({
        host: DART_GAME_SERVER_HOST,
        port: DART_GAME_SERVER_PORT,
        path: '/api/throw',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(encoded)
        }
      }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          console.log("game response: " + chunk);
        });
      });

  req.on('error', (e) => {
    console.log(`game response: problem with request: ${e.message}`);
  });
  req.write(encoded);
  req.end();
}
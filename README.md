# darts-connect

This project provides a class that connects to a [Darts Connect](http://www.darts-connect.com) dartboard and reads the throws in real time. It does not know how to read the photo that is passed from the built in camera.

## Usage

The following example shows you how to create a client and parse the throw data into an object and print it. You'll need to know it's IP address for now. If you don't know the IP address simply launch the app that came with the board and on the screen that connects to the board it will show the IP address.

```javascript
var DartsConnectClient = require(__dirname + '/DartsConnectClient.class.js'),
    client = new DartsConnectClient({log: false});

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
      console.log(throwData);
      break;

    case 'next':
      throwData = {type: 'MISS', number: 0};
      console.log(throwData);
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
}});
```

If you look in `index.js` you'll see an example that creates a Darts Connect client and passes the data to a darts game server ([like this one](https://github.com/archanglmr/dart-server)).
'use strict';
var net = require('net');

/**
 * @todo: Don't ping while reading throw
 * @todo: add discovery stuff
 * @todo: add auto reconnect
 */

const PORT = 11080,
    BOARD_MAP = require(__dirname + '/lib/board_map.js'),
    PING_PACKET = new Buffer('23080000ff000000000000000000000000000000', 'hex'),
    PING_RESPONSE = '23080000ff0000000101000008000000003050400100000000000000';


module.exports = class DartsConnectClient {
  /**
   * Create a nw DartsConnect Client, but don't connect to the board yet.
   *
   * @param log {function}
   */
  constructor({log = false}) {
    /**
     * Set up a logging function
     */
    this.log = log ? function() {console.log.apply(console, arguments)} : () => {};

    this.host = null;
    this.port = null;
    this.client = null;
    this.ping_interval = null;
    this.ping_interval_time = null;
    this.callback = (e) => {};

    //this.connection_start_time = null;
    //this.connection_end_time = null;
  }

  /**
   * Connect to the board. Requires a host or address to connect to.
   *
   * @param host
   *
   * @param callback
   * @param ping_time
   * @param port
   */
  connect(host, {callback, ping_time = 60000, port = PORT}) {
    if (null === this.client) {
      this.host = host;
      this.port = port;
      this.ping_interval_time = ping_time;
      this.callback = callback || this.callback;

      this.client = new net.Socket();
      this.client.setEncoding('hex');

      this.client.connect(this.port, this.host, () => {
        this.log(`Connected to: ${this.host}:${this.port}`);
        this.log((new Date()).getTime());
      });


      this.client.on('data', (chunk) => {
        var event = analyze_data(chunk, this.log);
        if (event) {
          this.emit(event);
        }
      });

      this.client.on('end', (data) => {
        this.log('>>> END');
        this.emit({type: 'end'});
        this.disconnect();
      });

      this.client.on('close', (data) => {
        this.log('Connection closed');
        this.log((new Date()).getTime());
        this.emit({type: 'close'});
        this.disconnect();
      });

      this.client.on('error', (error) => {
        this.log(error);
        this.emit({type: 'error', data: error});
      });


      /**
       * Set up the ping with the ping_packet
       */
      this.ping_interval = setInterval(() => {
        this.ping();
      }, this.ping_interval_time);
    }
  }


  disconnect() {
    if (this.ping_interval) {
      clearInterval(this.ping_interval);
      this.ping_interval = null;
    }
    if (null !== this.client) {
      this.client.destroy();
      this.client = null;
    }
  }

  /**
   * Sends the ping packet to the dartboard. This need to happen every so often
   * or the board will close the connection after about 5 min. The default ping
   * interval is 1 minute and seems to work pretty well. If there is no client
   * false is returned.
   *
   * @returns {boolean}
   */
  ping() {
    if (this.client) {
      this.client.write(PING_PACKET);
      this.log('< PING');
      return true;
    }
    this.log('No connection to dartboard');
    return false;
  }

  /**
   * Emit's an event to the callback passed on connection. Types are:
   *
   *
   * unknown: Unknown data received.
   * connected: When an connection is established to the dartboard.
   * pinged: When a ping response is received.
   * bad_header: Packet begins with an unknown header.
   * closed: Connection was closed by the dartboard.
   * end: Connection disappeared I believe???
   * error: Any sort of socket error. This will have a 'data' key with the error
   * throw: A typical throw. This also returns a 'data' key with the throw
   *        information. See lib/board_map.js for valid values.
   * next: When the "next player" button is hit on the board
   *
   * @param event
   */
  emit(event) {
    this.callback(event);
  }
};













/*******************************************************************************
 * HELPERS
 ******************************************************************************/

var throw_data = null,
    last_data_was_next_turn = false, // when the last packets received were the "next turn" packets
    ignore_next_turn_till = 0; // how long to ignore next turn responses

/**
 * Analyzes the packet from the dartboard and returns an event to Emit.
 *
 * @param data
 * @param log
 * @returns {{type: string, data}}
 */
function analyze_data(data, log) {
  const HEADER = '23080000010000000',
      HEADER_LENGTH = HEADER.length,

      INITIAL_CONNECTION_HEADER = '60100001c000000a0ef7240',
      NEXT_TURN_PAYLOAD = '40100000800000052010000a0ef714000100000',
      THROW_HEADER = '2010000',
      THROW_FOOTER = 'ffd9';

  var event = null;

  if (data.substr(0, HEADER_LENGTH) === HEADER) {
    let payload = data.substr(HEADER_LENGTH);

    if (begins_with(INITIAL_CONNECTION_HEADER, payload)) {
      // ENDINGS
      //38120000000000000020000002000000080000000000000052010000
      //381200000000000000200000020000000800000000000000ff000000
      //00204e40000000000020000002000000080000000000000052010000
      //00204e400000000000200000020000000800000000000000ffffffff
      //080b02400000000000200000020000000800000000000000c8254e40
      //080b02400000000000200000020000000800000000000000ffffffff
      log('Initial connection:');
      log(payload.substr(INITIAL_CONNECTION_HEADER.length));
      log('');
      event = {type: 'connected'};


    } else if (begins_with(NEXT_TURN_PAYLOAD, payload)) {
      // full packet for next turn
      if (last_data_was_next_turn && ((new Date()).getTime()) < ignore_next_turn_till) {
        //log('ignoring multiple "next turns"');
        return;
      } else {
        log("> NEXT TURN");
        last_data_was_next_turn = true;
        ignore_next_turn_till = (new Date()).getTime() + 50;
        event = {type: 'next'};
      }
      return event;


    } else if (begins_with(THROW_HEADER, payload)) {
      if (ends_with(THROW_FOOTER, payload)) {
        let key = payload.substr(THROW_HEADER.length + 24, 2),
            str = BOARD_MAP[key];

        log("> THROW: " + formatThrow(str || 'unknown'));
        //log(
        //    payload.substr(THROW_HEADER.length, 36) +
        //    ' : ' +
        //    key +
        //    ' : ' +
        //    (throw_map[key] || 'unknown')
        //);
        event = {type: 'throw', data: str};
      } else {
        //log('still reading...');
        throw_data = data;
      }


    } else {
      log('DATA:');
      log(data);
      log('');
    }
  } else if (PING_RESPONSE === data) {
    // nothing to do really
    log('> PING RESPONDED');
    event = {type: 'pinged'};
  } else if (null !== throw_data) {
    throw_data += data;
    if (ends_with(THROW_FOOTER, data)) {
      // finished receiving throw...
      let full_data = throw_data;
      throw_data = null;
      log('finished reading...');
      return analyze_data(full_data, log);
    }
  } else {
    event = {type: 'bad_header'};
    log('BAD HEADER:');
    log(data);
    log('');
  }

  last_data_was_next_turn = false;
  return event;
}

/**
 * Makes sure the haystack string ends with the needle string.
 *
 * @param needle
 * @param haystack
 * @returns {boolean}
 */
function ends_with(needle, haystack) {
  return haystack.substr(haystack.length - needle.length) === needle;
}

/**
 * Makes sure the haystack string begins with the needle string.
 *
 * @param needle
 * @param haystack
 * @returns {boolean}
 */
function begins_with(needle, haystack) {
  return haystack.substr(0, needle.length) === needle;
}


/**
 * Used for this.log() messages
 *
 * @param str
 * @returns String
 */
function formatThrow(str) {
  var type_map = {
        d: 'Double',
        o: 'Outer',
        t: 'Triple',
        i: 'Inner'
      },
      type = str.substr(0, 1),
      value = str.substr(1);


  if ('B' === value) {
    value = 'Bull';
    if ('o' === type) {
      type = 'Single';
    }
  }
  if (type_map[type]) {
    type = type_map[type];
  }

  return type ? (`${type} ${value}`) : str;
}
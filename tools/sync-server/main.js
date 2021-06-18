

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 9080 })
var clients = new Set();
var clientCounter = 0;
var colors = [];

console.log('vts-browser-js-pos-sync is running at ' + JSON.stringify(wss.address()));

wss.on('connection', ws => {

    // dos protection
    if (clients.size > 20) {
        ws.terminate();
    }

    clients.add(ws);

    ws.on('message', message => {

        try {
          //console.log(`Received message => ${message}`)

          var json = JSON.parse(message);

          switch(json.command) {
              case 'client':
                  ws._channel_ = json.channel;
                  ws._id_ = json.id;

                  if (typeof ws._colorIndex_ === 'undefined') {
                      var index = colors.indexOf(json.id);
                      if (index == -1) {
                          index = 0;

                          while (colors[index]) {
                              index++;
                          }

                          colors[index] = json.id;
                      }

                      ws._colorIndex_ = index;
                  }

                  console.log(`new client in channel: ${ws._channel_} color:` + ws._colorIndex_);

                  //ws.send('{"command":"id", "id":' + clientCounter + '}');
                  //clientCounter++;

                  break;

              case 'cursor':
              case 'hide-cursor':

                if (typeof ws._colorIndex_ === 'undefined') {
                    break;
                }

                message = message.replace(' }', ', "color":' + ws._colorIndex_ + '  }');

              case 'pos':
                  if (ws._channel_) {


                      for(let client of clients) {

                          if (client != ws && client._channel_ == ws._channel_) {
                              client.send(message);
                          }
                      }

                  }
                  break;

              default:
          }

        } catch(e) {
          console.log(e);
        }

    })

    ws.on('close', message => {
        console.log(`removed client in channel: ${ws._channel_}`)

        if (ws._colorIndex_ !== null) {
            colors[ws._colorIndex_] = 0;
        }

        clients.delete(ws);
    })


})

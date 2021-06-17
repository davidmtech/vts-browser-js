

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 9080 })
var clients = new Set();

console.log('vts-browser-js-pos-sync is running at ' + JSON.stringify(wss.address()));

wss.on('connection', ws => {

  clients.add(ws);

  ws.on('message', message => {

      try {
          console.log(`Received message => ${message}`)

          var json = JSON.parse(message);

          switch(json.command) {
              case 'client':
                  ws._channel_ = json.channel;

                  console.log(`new client in channel: ${ws._channel_}`)
                  break;

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

    //ws.send('Hello! Message From Server!!' + `Received message => ${message}`)

  })

  ws.on('close', message => {
      console.log(`removed client in channel: ${ws._channel_}`)
      clients.delete(ws);
  })


})

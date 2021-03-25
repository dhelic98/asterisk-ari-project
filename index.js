/*jshint node:true*/
'use strict';

var ari = require('ari-client');
var util = require('util');

let currentBridge = '';
let bridgeType = '';

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

ari.connect('http://localhost:8088', 'dzeno', 'dzeno', clientLoaded);


// handler for client being loaded
function clientLoaded(err, client) {
    if (err) {
        throw err;
    }


    let getUserInput = () => {
        readline.question('', option => {
            option = option.split(' ');
            switch (option[0]) {
                case 'dial':
                    makeAcall(option.slice(1, option.length));
                    getUserInput();
                    break;
                case 'join':
                    joinConference(option.splice(1, option.length));
                    getUserInput();
                    break;
                case 'list':
                    listCalls();
                    getUserInput();
                    break;
                default:
                    console.log("Wrong option");
                    getUserInput();
                    break;
            }
        });
    }

    getUserInput();

    function makeAcall(extensions) {
        console.log(extensions);
        if (extensions.length == 2) {
            client.channels.create({
                app: 'channel-dump',
                endpoint: 'PJSIP/' + extensions[0]
            }, (err, channelOrig) => {
                if (err) {
                    throw err;
                } else {
                    client.channels.create({
                        app: 'channel-dump',
                        endpoint: 'PJSIP/' + extensions[1]
                    }, (err, channelDestin) => {
                        var bridge = client.Bridge();
                        bridge.create(function(err, bridge) {
                            client.channels.dial({ channelId: channelDestin.id });
                            client.channels.dial({ channelId: channelOrig.id });
                            bridge.addChannel({ channel: channelOrig.id });
                            bridge.addChannel({ channel: channelDestin.id });
                            currentBridge = bridge.id;
                            bridgeType = '0';
                        });
                        channelOrig.on('ChannelEnteredBridge', function(event, obj) {})
                        channelDestin.on('ChannelEnteredBridge', function(event, obj) {})
                    });
                }
            });
        } else {
            var bridge = client.Bridge();
            bridge.create({ type: 'mixing' }, function(err, bridge) {
                bridgeType = '1';
                extensions.forEach(ext => {
                    client.channels.create({ app: 'channel-dump', endpoint: 'PJSIP/' + ext }, (err, channel) => {
                        client.channels.dial({ channelId: channel.id });
                        bridge.addChannel({ channel: channel.id });
                    })
                });
                currentBridge = bridge.id;
            });
        }
    }


    function joinConference(options) {
        console.log(options);
        let callId = options[0];
        let extensions = options.splice(1, options.length);
        console.log(extensions);
        let bridge = null;
        client.bridges.list(
            function(err, bridges) {
                bridge = bridges[callId - 1];
                currentBridge = bridge.id;
                extensions.forEach(extension => {
                    client.channels.create({ app: 'channel-dump', endpoint: 'PJSIP/' + extension }, (err, channel) => {
                        client.channels.dial({ channelId: channel.id });
                        bridge.addChannel({ channel: channel.id });
                    });
                })
            }
        );
    }

    function listCalls() {
        client.bridges.list(
            function(err, bridges) {
                let i = 1;
                if (bridges.length == 0) {
                    console.log("There are no available calls");
                } else {
                    console.log("Available calls");
                    bridges.forEach(b => {
                        console.log(i++ + ") Call")
                        console.log("ID: " + b.id);
                        console.log("Name: " + b.name)
                        console.log("Creation time: " + b.creationtime);
                        console.log("People on call: " + b.channels.length);
                        console.log('\n');
                    })
                }
            }
        );
    }

    // handler for StasisStart event
    function stasisStart(event, channel) {
        // use keys on event since channel will also contain channel operations
        Object.keys(event.channel).forEach(function(key) {
            console.log(util.format('%s: %s', key, JSON.stringify(channel[key])));
        });
    }

    // handler for StasisEnd event
    function stasisEnd(event, channel) {
        client.bridges.get({ bridgeId: currentBridge }, function(err, bridge) {
            if (bridge.channels.length == 0) {
                bridge.destroy();
            }
            if (bridgeType == '0') {
                if (bridge.channels.length < 2) {
                    bridge.channels.forEach(mchannel => {
                        client.bridges.removeChannel({ bridgeId: bridge.id, channel: mchannel }, function(err) {
                            if (err) {
                                throw err;
                            }
                        })
                        client.channels.hangup({ channelId: mchannel },
                            function(err) {
                                if (err) {
                                    throw err;
                                }
                            }
                        );
                    });
                }
            }
        });
    }

    client.on('StasisStart', stasisStart);
    client.on('StasisEnd', stasisEnd);

    client.start('channel-dump');
}
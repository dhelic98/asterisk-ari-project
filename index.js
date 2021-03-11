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

    readline.question('Choose your option?\n1)Call between 2 extensions\n2)Call between multiple extensions\n3)Join an existing call\n', option => {
        option = parseInt(option);
        switch (option) {
            case 1:
                makeAcall();
                break;
            case 2:
                createConference();
                break;
            case 3:
                joinConference();
                break;
            default:
                console.log("Wrong option");
                break;
        }
    });

    function makeAcall() {
        let extensions = [];
        let counter = 0;
        let getExtension = () => {
            readline.question('Enter first extension?\n', extension => {
                ++counter;
                extensions.push(extension);
                if (counter < 2) {
                    getExtension();
                } else {

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
                }
            })
        }
        getExtension();
    }


    function createConference() {
        let extensions = [];
        let channels = [];
        readline.question('Enter number of extensions?\n', number => {
            number = parseInt(number);
            let getExtension = () => {
                readline.question('Enter extension\n', ext => {
                    --number;
                    extensions.push(ext);
                    if (number > 0) {
                        getExtension();
                    } else {
                        var bridge = client.Bridge();
                        bridge.create({ type: 'mixing' }, function(err, bridge) {
                            bridgeType = '1';
                            extensions.forEach(ext => {
                                client.channels.create({ app: 'channel-dump', endpoint: 'PJSIP/' + ext }, (err, channel) => {
                                    channels.push(channel);
                                    client.channels.dial({ channelId: channel.id });
                                    bridge.addChannel({ channel: channel.id });
                                })
                            });
                            currentBridge = bridge.id;
                        });
                    }
                });
            }
            getExtension();
        });


    }

    function joinConference() {
        client.bridges.list(
            function(err, bridges) {
                let i = 1;
                console.log("Available conferences");
                bridges.forEach(b => {
                    console.log(i++ + ") Conference")
                    console.log("ID: " + b.id);
                    console.log("Name: " + b.name)
                    console.log("Creation time: " + b.creationtime);
                    console.log('\n');
                })
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
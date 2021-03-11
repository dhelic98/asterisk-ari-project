/*jshint node:true*/
'use strict';

var ari = require('ari-client');
var util = require('util');

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
                                channelDestin.dial({ channelId: channelOrig.id });
                            });
                        }
                    });
                }
            })
        }
        getExtension();
    }


    function createConference() {

    }

    function joinConference() {

    }

    // handler for StasisStart event
    function stasisStart(event, channel) {
        console.log(util.format(
            'Channel %s has entered the application', channel.name));

        // use keys on event since channel will also contain channel operations
        Object.keys(event.channel).forEach(function(key) {
            console.log(util.format('%s: %s', key, JSON.stringify(channel[key])));
        });
    }

    // handler for StasisEnd event
    function stasisEnd(event, channel) {
        console.log(util.format(
            'Channel %s has left the application', channel.name));
    }

    client.on('StasisStart', stasisStart);
    client.on('StasisEnd', stasisEnd);

    client.start('channel-dump');
}
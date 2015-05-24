"use strict";
var tls = require("tls");
var net = require("net");
var http = require('http');

var debug = require("debug")("apn:socket");

function DestroyEPIPEFix(e) {
	// When a write error occurs we miss the opportunity to
	// read error data from APNS. Delay the call to destroy
	// to allow more data to be read.
	var socket = this;
	var args = arguments;
	var call = function () {
		socket._apnDestroy.apply(socket, args); 
	};
	
	if (e && e.syscall === "write") {
		setTimeout(call, 1000);
	}
	else {
		call();
	}
}

function getProxiedSocket(options, gotSocket) {
    var req = http.request({
        hostname: options.proxyHost,
        port: options.proxyPort,
        method: 'CONNECT',
        path: options.socketOptions.host + ':' + options.socketOptions.port
    });

    req.end();

    req.on('connect', function(res, socket, head) {
        gotSocket(socket);
    });
}

function apnSocket(connection, options, connected) {
    if (options.proxyHost) {
        getProxiedSocket(options, establishConnectionOnSocket);
    } else {
        establishConnectionOnSocket();
    }

    function establishConnectionOnSocket(s) {
        var socketOptions = options.socketOptions;
        socketOptions.socket = s;

        var socket = tls.connect(socketOptions, function() {
            connected(socket);
        });

        if (!socketOptions.disableEPIPEFix) {
            socket._apnDestroy = socket._destroy;
            socket._destroy = DestroyEPIPEFix;
        }

        socket.setNoDelay(socketOptions.disableNagle);
        socket.setKeepAlive(true);
        if (socketOptions.connectionTimeout > 0) {
            socket.setTimeout(socketOptions.connectionTimeout);
        }

        debug("connecting to: ", socketOptions.host + ":" + socketOptions.port);
    }
}

module.exports = apnSocket;

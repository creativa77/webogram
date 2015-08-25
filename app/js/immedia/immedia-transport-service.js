'use strict';

/**************************************************************************************
 * Transport service                                                                  *
 *                                                                                    *
 * This service handles the basic communication with the server,                      *
 * handles replies and has a heartbeat service to check if the connection is working. *
 *                                                                                    *
 **************************************************************************************/

(function() {

  var immediaServices = angular.module('immediaServices');

  immediaServices.service('TransportService', ['$rootScope', '$timeout', '$interval', 'ConfigService', function($rootScope, $timeout, $interval, cfgSvc) {
    var TRACE = false;                    // Show some tracing messages
    var sockjs;                           // Sockjs object
    var opened = false;                   // Marks the socket as opened (or not)
    var reconnect = true;                 // Should I try to reconnect if disconnected?
    var reconnectAttempt = 0;             // # of reconnect attempt
    var reconnectWait = 0;                // ms to wait for next reconnect attempt
    var roomName;                         // Name of the room we are connected to
    var sessionId;                        // Session Id
    var msgId = 0;                        // Message Id - Incremental value used to correlate message/reply
    var lastReceivedEvent = undefined;    // TS of last event ( msg, event, etc) received
    var heartbeatHndl = undefined;        // Heartbeat handle, it sends periodical pings
    var heartbeatWatchdogHndl = undefined;// Heartbeat watchdog handle, checks elapsed time since last received ping
    var pendingReplyMap = {};             // Map of callbacks waiting for a reply
    var pingInterval = 1000 * 5;          // Seconds between pings
    var avoidedPings = 0;                 // Number of pings skiped
    var that = this;

    this.isOpened = function() {
      return opened;
    };

    this.setSessionId = function(id) {
      sessionId = id;
    };

    this.send = function(type, payload, cb) {
      var msg = {
        msgId: ++msgId, //Start with 1
        type: type,
        room: roomName,
        data: (payload?payload:null)
      };

      //If there is a session ID, use it
      if ( sessionId ) {
        msg.id = sessionId;
      }

      if ( cb ) {
        pendingReplyMap[msg.msgId] = {cb: cb, timestamp: new Date().getTime()};
      }

      try {
        sockjs.send(angular.toJson(msg));
      } catch (err) {
        console.warn("Failed to send message",err);
      }

      //Recyle counter
      if ( msgId >= 1000 ) {
        msgId = 0;
      }
    };

    var stopHeartbeat = function() {
      if (undefined != heartbeatWatchdogHndl) {
          console.log("Stoping heartbeat watchdog");
          $interval.cancel(heartbeatWatchdogHndl);
          heartbeatWatchdogHndl = undefined;
      }
      if (undefined != heartbeatHndl) {
          console.log("Stoping heartbeat");
          $interval.cancel(heartbeatHndl);
          heartbeatHndl = undefined;
      }
    };

    var ping = function(ts) {
      if ( avoidedPings > 0 ) {
        console.log("Sending ping after " + avoidedPings + " avoided pings.");
        avoidedPings = 0;
      }

      that.send('ping', {}, function(reply) {
        lastReceivedEvent = new Date().getTime();
        $rootScope.$broadcast('ping', (lastReceivedEvent - ts));
      });
    };

    var startHeartbeat = function() {
      stopHeartbeat();

      ping(new Date().getTime()); //Initial ping

      //Heartbeat
      console.log("Starting heartbeat");
      heartbeatHndl = $interval(function(){
        var ts = new Date().getTime();

        if ( (ts - lastReceivedEvent) >= pingInterval || avoidedPings >= 10 ) {
          ping(ts);
        } else {
          avoidedPings++;
        }
      }, pingInterval); //Send a ping every 5 secs

      //Heartbeat watchdog
      console.log("Starting heartbeat watchdog");
      heartbeatWatchdogHndl = $interval(function(){
        var ts = new Date().getTime();

        if ( (ts - lastReceivedEvent) > (pingInterval * 5) ) {
          console.log("I'm getting no pings!!");
          $rootScope.$broadcast('ping', "ERR");
          that.reconnect();
        }
      }, pingInterval);
    };

    $rootScope.$on("opened", startHeartbeat);
    $rootScope.$on("closed", stopHeartbeat);

    //----------------- Public methods -------------------//

    /* to be overidden */
    this.onmessage = function(msg) {
      console.log("OVERRIDE onmessage");
    };

    this.open = function(room_name) {
      if ( opened ) { //FIXME: different roomName check
        return;
      }
      roomName = room_name;

      //start connection
      sockjs = new SockJS('https://immedia.herokuapp.com/ws', null, {debug: true});

      sockjs.onclose  = function() {
        sockjs = null;
        opened = false;
        console.log("Closed!");
        $rootScope.$broadcast('closed');
        if ( reconnect ) {
          $timeout(function(){that.reconnect();}, reconnectWait);
        }
      };

      sockjs.onmessage = function(msg) {
        var data = angular.fromJson(msg.data);

        if ( data.replyTo && pendingReplyMap[data.replyTo] ) { //This is a response message
          TRACE && console.debug("Handling reply msg", data);
          var cb = pendingReplyMap[data.replyTo].cb;
          delete pendingReplyMap[data.replyTo];
          cb.call(this, null, data.data);
          return;
        }

        lastReceivedEvent = new Date().getTime();

        that.onmessage(data);


        //After receiving a message from the server, digest the scope as very probably something changed
        $rootScope.$digest();
      };

      sockjs.onopen = function() {//handshake;
        console.log("Opened");
        opened = true;
        $rootScope.$broadcast('opened');

        //Reset reconnect params
        reconnectAttempt = 0;
        reconnectWait = 0;
      };
    };

    this.disconnect = function(cancelReconnect) {
      if ( cancelReconnect === true ) {
        reconnect = false;
      }

      sockjs && sockjs.close();
      $rootScope.$broadcast('disconnected');
      sockjs = null;
    };

    this.reconnect = function() {
      console.log("Reconnecting...");
      opened = false;
      reconnectAttempt++;
      reconnectWait = reconnectAttempt * 300;
      this.open(roomName);
    };

    this.sendMessage = function(msg, cb) {
      this.send("app", msg, cb);
    };
  }]);
}());

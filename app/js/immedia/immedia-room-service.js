'use strict';

/* Room service */

(function() {

  var immediaServices = angular.module('immediaServices');

  console.log('xxx service');

  immediaServices.service('RoomService', ['$rootScope', '$interval', 'TransportService', 'ConfigService', '$localStorage',
                          function($rootScope, $interval, transport, cfgSvc, $localStorage) {
    var _roomPassword;
    var _sessionId;
    var _roomName;
    var connected = false;
    var participants = [];
    var participantsMap = [];
    var that = this;
    var TRACE = false;
    var TRACE_GC = false;

    // Setting a small cache limit for now
    // 30 people * 10 messages per day = 300 snapshots in cache
    // Total size (aprox): 3000 * 10kB = 3000kB ~= 3MB
    // We can make it bigger in the future if needed
    var MAX_SNAPSHOTS = 300;

    // JAC TODO: Move this fully from the controller to here
    var canvas;

    var storage = $localStorage.$default({
      snapshotsByMessageId: {}
    });

    function addSnapshotToStorage(msg) {
      var msgId2 = msg.peerId + ":" + msg.timestamp;
      var snapshotsInCacheKeys = Object.keys(storage.snapshotsByMessageId).sort((a, b) => {
        var timestampA = a.split(':')[1];
        var timestampB = b.split(':')[1];
        return timestampA - timestampB;
      });

      var amountOfPicsInCache = snapshotsInCacheKeys.length;

      if (amountOfPicsInCache >= MAX_SNAPSHOTS) {
        var amountToRemove = amountOfPicsInCache - MAX_SNAPSHOTS + 1;
        snapshotsInCacheKeys.length = amountToRemove;
        snapshotsInCacheKeys.forEach((key) => {
          delete storage.snapshotsByMessageId[key];
        })
      }
      storage.snapshotsByMessageId[msgId2] = msg;
    };

    $interval(function(){
      var staleThreshold  = new Date().getTime() - 10 * 1000; //10 Seconds
      var removeThreshold = staleThreshold - 10 * 1000; //20 seconds in total

      var toKick = [];

      for(var id in participantsMap) {
        var participant = participantsMap[id];

        if ( participant.lastUpdate < removeThreshold ) {
          TRACE_GC && console.debug("Participant " + id + " is disconnected");
          toKick.push(id);
        } else {
          if ( participant.lastUpdate < staleThreshold ) {
            TRACE_GC && !participant.stale && console.debug("Participant " + id + " is stale");
            participant.stale = true;
          } else {
            participant.stale = false;
          }
        }
      }

      if ( toKick.length > 0) {
        TRACE_GC && console.debug("Garbage collecting " + toKick.length + " participants");
        participantLeft(toKick);
      }
    }, 1500); //Run the GC every 1.5 secs

    var participantJoin = function(id, data /* optional */) {
      var participant = data || {};
      participant.id = id;
      if (! participantsMap[id] ) { //We didn't have this participant
        participants.push(participant);
        TRACE && console.debug("Added new participant: " + id);
      } else {
        TRACE && console.debug("Added existing participant: " + id);
      }
      participantsMap[id] = participant;
      participant.stale = false;
      participant.lastUpdate = new Date().getTime();
      console.log("We are " + (1 + participants.length) + " participants in the room");
    };

    var participantLeft = function(ids) {
      if ( ! ids || ids.length == 0 ) {
        return;
      }

      var hadParticipant = false;
      for ( var i = 0 ; i < ids.length ; i++) {
        for ( var j = 0 ; j < participants.length ; j++ ) {
          if ( participants[j].id == ids[i] ) {
            delete participantsMap[ids[i]];
            participants.splice(j,1);
            hadParticipant = true;
            break;
          }
        }
      }
      hadParticipant && console.debug( ids.length + " participants left. We are " +(1+participants.length) + " participants in the room");
    };

    var participantUpdate = function(data) {
      if (!(data.id in participantsMap)) {
        participantJoin(data.id, data);
      }
      var participant = participantsMap[data.id];

      participant.image = data.image;
      participant.lastUpdate = new Date().getTime();
      participant.stale = false;
      participant.nickname = data.nickname;
    };

    var handleMessage = function(msg) {
      switch(msg.type) {
        case 'join':
          participantJoin(msg.data);
          break;
        case 'left':
          participantLeft(msg.data);
          break;
        case 'update':
          participantUpdate(msg.data);
          break;
      }
      if ( TRACE ) {
        console.debug("Broadcasting to rootScope message of type '" + msg.type + "'", msg.data);
      }
      $rootScope.$broadcast(msg.type, msg.data);
    };

    this.enterRoom = function() {
      console.log("Entering room");

      transport.send("sub", {password:_roomPassword}, function(err, data) {
        //TODO: Check for error msgs
        if ( data && data.success === true ) {
          //Save the session for reconecting, and sending future messages
          _sessionId = data.id;
          transport.setSessionId(_sessionId);
          console.log("Subscribed to room " + _roomName + " with session " + _sessionId);
          //storage['rooms'][_roomName].lastAccess = new Date().getTime();

          connected = true;
          $rootScope.$broadcast('connected');
          $rootScope.$digest();
        } else {
          if ( data && data.error ) {
            $rootScope.$broadcast('failed-auth', data.error);
          } else {
            $rootScope.$broadcast('error', "Failed request for unknown reason");
          }
        }
      });
    };

    $rootScope.$on("opened", function(scope) {
        console.log("Transport is ready!");
        if ( ! cfgSvc.isConfigured(_roomName) ) {
          console.log("Reading room configuration");

          cfgSvc.setConfiguration(_roomName, {
            securedRoom: false
          });
        } else {
          that.enterRoom();
        }
    });

    this.connect = function(roomName, password) {
      //If there is no password, or at least not a password set, use boolean false, as that is what the
      //server expects when there is no password.
      _roomName = roomName;
      if (! password ) {
        _roomPassword = false;
      } else {
        _roomPassword = password;
      }

      //storage.rooms[_roomName] = {};

      if ( transport.isOpened() ) {
        this.enterRoom();
      } else {
        transport.open(roomName);
      }
    };

    this.leaveRoom = function() {
        console.log("TODO: Implement RoomService.leaveRoom");
    };

    this.disconnect = function() {
      transport.disconnect(true);
    };

    this.sendMessage = function(msg) {
      transport.sendMessage({type: 'message', data: msg});
    };

    this.update = function(msg) {
      transport.sendMessage({type: 'update', data: msg});
    };

    this.getAvailableMessages = function(cb) {
      transport.sendMessage({type: 'get-all-messages'}, cb);
    };

    this.getParticipants = function() {
      return participants;
    };

    this.setNickname = function(nickname) {
      cfgSvc.setNickname(_roomName, nickname);
    };

    this.getNickname = function() {
      return cfgSvc.getNickname(_roomName);
    };

    $rootScope.$on('message', function(scope, msg) {
      addSnapshotToStorage(msg);
    });

    this.sendSnapshot = function(data) {
      var URL = canvas.toDataURL();
      var msg = {
        timestamp: data.date,
        peerId: data.peerId,
        messageId: data.messageId,
        image: URL
      };
      this.sendMessage(msg);

      // Add to the hash list
      addSnapshotToStorage(msg);
    };

    this.getImageUrl = function(messageId) {
      var snapshot = storage.snapshotsByMessageId[messageId];
      return snapshot && snapshot.image;
    };

    this.setCanvas = function(theCanvas) {
      canvas = theCanvas;
    };

    transport.onmessage = handleMessage;
  }]);

}());

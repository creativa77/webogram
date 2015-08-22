'use strict';

/* Config service */

(function() {

  var immediaServices = angular.module('immediaServices');

  immediaServices.service('ConfigService', ['$rootScope', '$localStorage', function($rootScope, $localStorage) {

    var storage = $localStorage.$default({
      rooms: {}
    });

    var configuration = {};

    this.isConfigured = function(room) {
      return configuration[room];
    };

    this.setConfiguration = function(room, conf) {
      configuration[room] = conf;
    };

    this.isRoomSecured = function(room) {
      return configuration[room].securedRoom === true;
    };

    this.isDefaultStartFT = function(room) {
      return configuration[room].defaultStartFT === true;
    };

    this.getConfiguration = function(roomName) {
      return configuration[room];
    };

    this.setNickname = function(roomName, nickname) {
      if (! storage.rooms[roomName] ) {
        storage.rooms[roomName] = {};
      }
      storage.rooms[roomName].nickname = nickname;
    };

    this.getNickname = function(roomName) {
      if ( storage.rooms[roomName] ) {
        return storage.rooms[roomName].nickname;
      }
      return undefined;
    };
  }]);
}());

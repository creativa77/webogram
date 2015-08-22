'use strict';

/* Config service */

(function() {

  var immediaServices = angular.module('immediaServices');

  immediaServices.service('ConfigService', ['$rootScope', '$localStorage', function($rootScope, $localStorage) {

    var storage = $localStorage.$default({
      rooms: {}
    });

    var configuration = {};

    var geOrCreateConf = function(room) {
      if (!configuration[room]) {
        configuration[room] = {
          securedRoom: false
        };
      }
      return configuration[room];
    };

    this.isConfigured = function(room) {
      return geOrCreateConf(room);
    };

    this.setConfiguration = function(room, conf) {
      configuration[room] = conf;
    };

    this.isRoomSecured = function(room) {
      return geOrCreateConf(room).securedRoom === true;
    };

    this.isDefaultStartFT = function(room) {
      return geOrCreateConf(room).defaultStartFT === true;
    };

    this.getConfiguration = function(roomName) {
      return geOrCreateConf(room);
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

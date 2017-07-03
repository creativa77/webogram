'use strict';

/* Room page controller */

(function() {

  var immediaControllers = angular.module('immediaControllers');

  immediaControllers.controller('RoomCtrl', ['$rootScope', '$scope', '$sce', '$window', '$routeParams', '$interval', 'RoomService', 'ConfigService', 'AppUsersManager',

    function($rootScope, $scope, $sce, $window, $routeParams, $interval, roomSvc, cfgSvc, appUsersManager) {

    $scope.connected = false;                   // Connected/Disconnected from the room
    $scope.roomName = undefined;                // Id of the room, taken from the URL
    $scope.participants;                        // Available participants
    $scope.videolessMode          = false;      // Hides others' videos if webcam is off
    $scope.videoUnavailable       = undefined;  // When the user doesn't accept ( or there is a problem with acquiring video )
    $scope.enteringInProgress     = false;      // Is an authentication process going on?
    $scope.ping                   = "N/A";      // Last ping time

    // Awareness button style
    $scope.disableButtonStyle = {opacity: 0};

    // Internal / status / private variables
    var canvas = $('#self')[0];                 // canvas on which snapshots are being drawn
    roomSvc.setCanvas(canvas);

    var updateIntervalPromise = undefined;
    var connectedRooms = {};

    //Checks for room selection change
    $scope.$watchCollection('curDialog', function(dialog) {
      var roomId = dialog.peer;

      if ($scope.roomName === roomId) {
        return;
      }

      $scope.roomName = roomId;

      if (cfgSvc.isAwarenessEnabled(roomId)) {
        if (!connectedRooms[roomId]) {
          startWebcam(function(){
            connectedRooms[roomId] = true;
            //Don't connect to the room until the user accepts the video feed
            roomSvc.connect(roomId);
          });
        }
      }
    });

    var leaveRoom = function() {
      console.log("Leaving room...");
      $scope.immediaSnapshots.stopVideo();
      $scope.immediaSnapshots = null;
      $interval.cancel(updateIntervalPromise);
      roomSvc.leaveRoom();
    };

    //If user leaves room, try to inform the server
    $scope.$on("$destroy", leaveRoom);

    $scope.$on("ping", function(scope, ms) {
      $scope.ping = ms;
    });

    //If Tab is closed or URL changed to something out of this world, also disconnect transport
    $window.onbeforeunload = function() {
      console.warn("TODO: DISCONNECT FROM ALL ROOMS");
      leaveRoom();

      roomSvc.disconnect();
    };

    $scope.enableAwareness = function() {
      cfgSvc.setAwarenessEnabled($scope.roomName, true);

      if (!connectedRooms[$scope.roomName]) {
        startWebcam(function(){
          connectedRooms[$scope.roomName] = true;
          //Don't connect to the room until the user accepts the video feed
          roomSvc.connect($scope.roomName);
        });
      }
    };

    $scope.disableAwareness = function() {
      cfgSvc.setAwarenessEnabled($scope.roomName, false);

      $scope.immediaSnapshots && $scope.immediaSnapshots.stopVideo();

      roomSvc.disconnect();

      delete connectedRooms[$scope.roomName];
    };

    $scope.showAwarenessPanel = function() {
      return cfgSvc.isAwarenessEnabled($scope.roomName);
    };

    $scope.showParticipantsPanel = function() {
      return cfgSvc.isAwarenessEnabled($scope.roomName);
    };

    $scope.$on("connected", function() {
      //Participants are added/removed from this array by the RoomService, no action required
      $scope.participants = roomSvc.getParticipants();

      //Send my info to the server
      updateRoom();

      if (! angular.isDefined(updateIntervalPromise)) {
        //Update the rest with my status every 5 seconds
        updateIntervalPromise = $interval(updateRoom, 1000*5);
      }
    });

    $scope.$on("disconnected", function() {
      $scope.connected = false;
      if (angular.isDefined(updateIntervalPromise)) {
          $interval.cancel(updateIntervalPromise);
          updateIntervalPromise = undefined;
      }
    });

    var updateRoom = function() {
      var username = appUsersManager.getSelf().username;
      roomSvc.update({ image: canvas.toDataURL(), timestamp: new Date().getTime(), nickname: username });
    };

    function startWebcam(cb) {
      // Start the snapshot component
      $scope.immediaSnapshots = new ImmediaTracker($('video')[0], canvas,
       {
          snapshotInterval:1000,
          startWithFaceTracking:false,
          showDebugMarkers:false
       });

      $scope.immediaSnapshots.start(
        function(err) {
          $scope.videoUnavailable = true;
          $scope.$digest();
          console.log("failed to start video...", err);
        },cb);
    }

    //-------------- Action functions ------------------//

    /**
     * Release the camera for some time and then automatically try to
     * grab it again
     */
    $scope.snoozeVideo = function() {
      $scope.immediaSnapshots.snoozeVideo();
    };

    /**
     * Releases the camera and hides other participant cameras.
     */
    $scope.killVideo = function() {
      $scope.immediaSnapshots.stopVideo();
      $scope.videolessMode = true;
    };

    $scope.toggleFaceTracking = function() {
      $scope.immediaSnapshots.toggleFaceTracking();
    };

    //-------------- Directives|Filters functions ------------------//

    $scope.setMyNickname = function() {
      roomSvc.setNickname($scope.myNickname);
      updateRoom();
      focusChatInputEl();
    };

    // --- Awareness --- //
    $scope.onMouseOverAwareness = function() {
      $scope.disableButtonStyle = {opacity: 1};
    }

    $scope.onMouseLeaveAwareness = function() {
      $scope.disableButtonStyle = {opacity: 0};
    }
  }]);

}());

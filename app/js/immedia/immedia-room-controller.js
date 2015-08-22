'use strict';

/* Room page controller */

(function() {

  var immediaControllers = angular.module('immediaControllers');

  console.log('xxx controller');

  immediaControllers.controller('RoomCtrl', ['$scope', '$sce', '$window', '$routeParams', '$interval', 'RoomService', function($scope, $sce, $window, $routeParams, $interval, roomSvc) {
    $scope.connected = false;                   // Connected/Disconnected from the room
    $scope.roomName = 'ekuton'; //$routeParams.roomName    // Name of the room, taken from the URL
    $scope.participants;                        // Available participants
    $scope.status = "Starting...";              // Status message
    $scope.showPasswordPanel      = false;      // Shows the password prompt panel. Don't set at the same time with showParticipantsPanel
    $scope.showParticipantsPanel  = false;      // Shows the participans panel. Don't set at the same time with showParticipantsPanel
    $scope.showActionsPanel       = undefined;  // Shows the lower buttons panel. This is just to initially hide the buttons. It never goes "false" again
    $scope.roomPassword;                        // The password typed
    $scope.videolessMode = false;               // Hides others' videos if webcam is off
    $scope.videoUnavailable = undefined;        // When the user doesn't accept ( or there is a problem with acquiring video )
    $scope.authInProgress         = false;      // Is an authentication process going on?
    $scope.ping                   = "N/A";      // Last ping time
    // Internal / status / private variables
    var canvas = $('#self')[0];                 // canvas on which snapshots are being drawn
    var updateIntervalPromise = undefined;
    var unreadMessages = 0;
    var alertAudio = null;

    //Updates the page title
    var updateTitle = function() {
      if ( unreadMessages > 0 ) {
        $window.document.title = "[" + unreadMessages + "] " + $scope.messages[0].text;
      } else {
        $window.document.title = "Immedia: " + $scope.roomName;
      }
    };

    $window.onfocus = function(ev) { // Reset the counter of unreaded messages
      unreadMessages= 0;
      updateTitle();
    };

    var leaveRoom = function() {
      console.log("Leaving room...");
      $scope.immediaSnapshots.stopVideo();
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
      leaveRoom();

      roomSvc.disconnect();
    };

    //Google Analytics, once the page is loaded
    $scope.$on('$viewContentLoaded', function() {
      $window.ga('send', 'pageview', { page: "Room#" + $scope.roomName });
    });

    $scope.$on("password-required", function() {
      $scope.showPasswordPanel = true;
      $scope.authInProgress = false;
      $scope.status = "Room is protected. Type in password.";
    });

    $scope.connect = function() {
      $scope.authInProgress = true;
      $scope.status = "Connecting to room...";
      roomSvc.connect($scope.roomName, $scope.roomPassword);
    };

    $scope.$on("connected", function() {
      $scope.showParticipantsPanel = true; // Show the participants panel
      $scope.showPasswordPanel = false; // Hide the password panel
      $scope.showActionsPanel = true;
      $scope.authInProgress = false;

      //Participants are added/removed from this array by the RoomService, no action required
      $scope.participants = roomSvc.getParticipants();
      $scope.myNickname = roomSvc.getNickname();

      //Send my info to the server
      updateRoom();

      //Get existing messages
      $scope.status = "Fetching existing messages";
      roomSvc.getAvailableMessages(function(err, data) {
        $scope.connected = true;
        $scope.messages = data;
        $scope.status = "Connected to room";
        if (! angular.isDefined(updateIntervalPromise)) {
          //Update the rest with my status every 5 seconds
          updateIntervalPromise = $interval(updateRoom, 1000*5);
        }
      });
    });

    $scope.$on("disconnected", function() {
      $scope.status = "Disconnected from room";
      $scope.connected = false;
      if (angular.isDefined(updateIntervalPromise)) {
          $interval.cancel(updateIntervalPromise);
          updateIntervalPromise = undefined;
      }
    });

    $scope.$on("message", function(scope, msg) {
      addMessages([msg], false);
    });

    $scope.$on("failed-auth", function(scope, msg) {
      $scope.needsPassword = true;
      $scope.authInProgress = false;
      $scope.status = "Failed authentication: " + msg;
      $scope.$digest();
    });

    $scope.sendMessage = function() {
      // Gather webcamshot to send with message
      var URL = canvas.toDataURL();

      // Send message to server
      var msg = {
        timestamp: new Date().getTime(),
        text: $scope.inputText,
        image: URL,
        nickname: $scope.myNickname
      };

      roomSvc.sendMessage(msg);

      $('textarea').val('');
      $scope.inputText = "";

      // Add it to the list locally
      addMessages([msg], true);
    };

    var updateRoom = function() {
      roomSvc.update({ image: canvas.toDataURL(), timestamp: new Date().getTime(), nickname: $scope.myNickname });
    };

    /**
     * Adds the message to the data model (which is in turn automatically rendered
     * through Angular.js bindings)
     */
    function addMessages(msgs, sendByCurrentUser) {
      // Insert the new message to the top of the list of messages
      $scope.messages = msgs.concat($scope.messages);

      // Crop the list of in-memory (and rendered) messages to a fixed maximum size
      var max_rows = 40; // Max number of rows hardcoded here
      if($scope.messages.length > max_rows) {
        $scope.messages.splice(max_rows,$scope.messages.length - max_rows);
      }

      if(!sendByCurrentUser){
        unreadMessages++;
        updateTitle();

        if ( alertAudio ) {
          alertAudio.play();
        }
      }
    }

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
          $scope.status = 'Error getting user media: ' + err;
          $scope.videoUnavailable = true;
          $scope.$digest();
          console.log("failed to start video...");
        },cb);
    }

    // Submit when you press Enter on the input.
    // It is on keydown and default is prevented to avoid adding the enter to the message
    $scope.keydown = function(ev) {
      if(ev && ev.keyCode == 13) {
        ev.preventDefault();
        $scope.sendMessage();
      }
    };

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

    /**
     * Triggered by clicking on the different alert modes
     */
    $scope.setAlertMode = function(mode) {
      if ( mode == "silent") {
        alertAudio = null;
      } else {
        alertAudio = new Audio('/audio/' + mode + '.ogg');
      }
    };

    $scope.toggleFaceTracking = function() {
      $scope.immediaSnapshots.toggleFaceTracking();
    };

    //-------------- Directives|Filters functions ------------------//

    $scope.setHtmlToTrusted = function(html_code) {
      return $sce.trustAsHtml(html_code);
    };

    /**
     * Focuses the chat input element after .3 second
     */
    var focusChatInputEl = function() {
      setTimeout(function() {
        $('#chat-input-element').focus();
      }, 300);
    };

    $scope.setMyNickname = function() {
      roomSvc.setNickname($scope.myNickname);
      updateRoom();
      focusChatInputEl();
    };

    //int main() {
    updateTitle();

    $scope.status = "Requesting access to webcam...";

    //TODO: Load from conf
    $scope.setAlertMode("default");

    startWebcam(function(){
      //Don't connect to the room until the user accepts the video feed
      $scope.connect();
    });

  }]);

}());

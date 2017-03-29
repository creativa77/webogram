/*!
 */

'use strict';

/* Directives */

angular.module('immedia', ['immediaControllers','immediaServices'])

  .directive('myImmediaPrescence', function() {
    return {
      restrict: 'AE',
      templateUrl: templateUrl('immedia_presence'),
      controller: 'RoomCtrl',
      link: link
    };

    function link($scope, element, attrs) {

      // HACK to adjust the history height to account for presence header and avoid
      // getting duplicate scrollbars
      // Idea: detect when height was calculated and updated by the awareness header
      // height (currently hardcoded to 61px)
      var adjustedHeight;
      $scope.$watch(
        function() { return $('.im_history_wrap')[0].style.height; },
        function(newValue, oldValue) {
          if (newValue != adjustedHeight) {
            adjustedHeight = (parseInt(newValue) - 61) + "px";
            $('.im_history_wrap')[0].style.height = adjustedHeight;
          }
        }
      );
    }
  })

  .directive('myImmediaSendMessage', ['$rootScope','RoomService', 'ConfigService',
             function($rootScope, roomService, configService) {
    return {
      restrict: 'AE',
      link: link
    };

    function link($scope, element, attrs) {

      // Keeps track of the currently selected roomm
      var currentRoomId;
      $scope.$watchCollection('curDialog', function(dialog) {
        currentRoomId = dialog.peer;
        // if (cfgSvc.isAwarenessEnabled(roomId)) {
        console.log('xxx current room:' + currentRoomId);
      });


      // Trap outgoing messages to insert immedia picture to go alongside the message.
      // Sends a picture to the immedia service.
      $scope.$on('apiUpdate', function (e, update) {
        switch (update._) {
          // NOTE: This is called both for new outgoing and new incoming messages
          // so we need to differentiate them using message flags.
          case 'updateNewMessage':
            if (update.message.pFlags.out && currentRoomId &&
                configService.isAwarenessEnabled(currentRoomId)) {
              roomService.sendSnapshot({
                peerId: update.message.from_id,
                messageId: update.message.id,
                date: update.message.date
              });
            }
            break;
        }
      });

      // Detect empty messages and insert emoticon.
      $scope.$on('immedia_ui_message_before_send', function(scope) {
        if($scope.draftMessage.text == "" &&
          configService.isAwarenessEnabled(currentRoomId)) {
          $('canvas')[0].toBlob(function(blob) {
            $scope.draftMessage.isMedia = true;
            $scope.draftMessage.files = [blob];
          });
        };
      });
    }
  }])

  .directive('myImmediaMessagePicture', ['RoomService', function(roomService) {
    return {
      link: link
    };

    function link($scope, element, attrs) {
      var imgEl = $('<img class="' + (attrs.imgClass || '') + '">')
      var immediaAnchor = element.find('.im_message_from_photo.immedia')
      var originalAnchor = element.find('.im_message_from_photo.no-immedia')

      $scope.$watch('historyMessage.id', updatePicture);
      $scope.$on('message', updatePicture);

      function updatePicture() {
        imgEl.remove();
        var msgId2 = $scope.$eval('historyMessage.from_id + \':\' + historyMessage.date');
        var imgUrl = roomService.getImageUrl(msgId2);
        if (imgUrl != undefined) {
          immediaAnchor.show();
          originalAnchor.hide();
          imgEl.prependTo(immediaAnchor).attr('src', imgUrl);
        } else {
          immediaAnchor.hide();
          originalAnchor.show();
        }
      };
    };

  }]);


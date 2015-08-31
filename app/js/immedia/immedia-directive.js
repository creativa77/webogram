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


      /*
      $scope.$on('ui_message_before_send', function() {
        console.log('xxx message sent!');
      });
      */
      $scope.$on('apiUpdate', function (e, update) {
        switch (update._) {
          // NOTE: This is called both for new outgoing and new incoming messages
          case 'updateNewMessage':
            if (update.message.out && currentRoomId &&
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

      // Detect empty messages
      $scope.$on('ui_message_before_send', function(scope) {
        if($scope.draftMessage.text == "") {

          // Insert and send the latest snapshot as a blob
          $('canvas')[0].toBlob(function(blob) {
            $scope.draftMessage.isMedia = true;
            $scope.draftMessage.files = [blob];
          });

          // Add a dummy text to force send
          // $scope.draftMessage.text = '-';
        };
      });

      // This gives the temporary ID only
      // broadcasted from services.js L1796 before the message is sent
      /*
      $scope.$on('history_append', function(e, data) {
        console.log('xxx history_append: ' + data.messageID);
      });
      */
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


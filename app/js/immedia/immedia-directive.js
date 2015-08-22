/*!
 */

'use strict';

/* Directives */

angular.module('immedia', ['immediaControllers','immediaServices'])

  .directive('myImmediaPrescence', function() {
    return {
      restrict: 'AE',
      templateUrl: templateUrl('../immedia_prescence'),
      controller: 'RoomCtrl'
    };
  })

  .directive('myImmediaSendMessage', ['$rootScope','RoomService', function($rootScope, roomService) {
    return {
      restrict: 'AE',
      link: link
    };

    function link($scope, element, attrs) {

      /*
      $scope.$on('ui_message_before_send', function() {
        console.log('xxx message sent!');
      });
      */
      $scope.$on('apiUpdate', function (e, update) {
        switch (update._) {
          // NOTE: This is called both for new outgoing and new incoming messages
          case 'updateNewMessage':
            if (update.message.out) {
              roomService.sendSnapshot({
                peerId: update.message.from_id,
                messageId: update.message.id,
                date: update.message.date
              });
            }
            break;
        }
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

      $scope.$watch('historyMessage.id', updatePicture);

      function updatePicture(messageId) {
        var msgId2 = $scope.$eval('historyMessage.from_id + \':\' + historyMessage.date');
        console.log('XXXX rendering message in list msgId2: ' + msgId2);
        imgEl.remove();
        imgEl.prependTo(element).attr('src', roomService.getImageUrl(msgId2));
      };
    };

  }]);


/*!
 */

'use strict';

/* Directives */

angular.module('immedia', ['immediaControllers'])

  .directive('myImmediaPrescence', function() {
    return {
      restrict: 'AE',
      templateUrl: templateUrl('immedia_prescence'),
      controller: 'RoomCtrl'
    };
  })

  .directive('myImmediaSendMessage', function() {
    return {
      restrict: 'AE',
      link: link
    };

    function link ($scope, element, attrs) {
      $scope.$on('ui_message_before_send', function() {
        console.log('xxx message sent!');
      });
      $scope.$on('apiUpdate', function (e, update) {
        switch (update._) {
          case 'updateMessageID':
            console.log('xxx updateMessageID: ' + update.id + ', rnd: ' + update.random_id);
            break;
          case 'updateNewMessage':
            console.log('xxx updateNewMessage: ' + update.message.id);
            break;
        }
      });
      $scope.$on('history_append', function(e, data) {
        console.log('xxx history_append: ' + data.messageID);
      });
    }
  });


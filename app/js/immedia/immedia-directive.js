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
  });

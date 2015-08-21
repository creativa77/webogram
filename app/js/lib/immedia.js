/*!
 */

'use strict';

/* Directives */

angular.module('immedia', [])

  .directive('myImmediaPrescence', function() {
    return {
      restrict: 'AE',
      templateUrl: templateUrl('immedia_prescence')
    };
  });

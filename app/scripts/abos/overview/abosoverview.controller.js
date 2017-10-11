'use strict';

/**
 */
angular.module('openolitor-admin')
  .controller('AbosOverviewController', ['$scope', '$filter', '$location',
    'AbosOverviewModel', 'NgTableParams', 'AbotypenOverviewModel',
    'FilterQueryUtil', 'OverviewCheckboxUtil', 'localeSensitiveComparator', 'EmailUtil', 'lodash', 'PersonenOverviewModel', 'gettext',
    function($scope, $filter, $location, AbosOverviewModel, NgTableParams,
      AbotypenOverviewModel, FilterQueryUtil, OverviewCheckboxUtil, localeSensitiveComparator, EmailUtil, _, PersonenOverviewModel, gettext) {

      $scope.entries = [];
      $scope.filteredEntries = [];
      $scope.loading = false;
      $scope.selectedAbo = undefined;
      $scope.model = {};

      $scope.search = {
        query: '',
        queryQuery: '',
        filterQuery: ''
      };

      $scope.checkboxes = {
        checked: false,
        checkedAny: false,
        items: {},
        css: '',
        ids: []
      };

      $scope.hasData = function() {
        return $scope.entries !== undefined;
      };

      $scope.abotypL = [];
      AbotypenOverviewModel.query({
        q: ''
      }, function(list) {
        angular.forEach(list, function(abotyp) {
          $scope.abotypL.push({
            'id': abotyp.id,
            'title': abotyp.name
          });
        });
      });

      // watch for check all checkbox
      $scope.$watch(function() {
        return $scope.checkboxes.checked;
      }, function(value) {
        OverviewCheckboxUtil.checkboxWatchCallback($scope, value);
      });

      // watch for data checkboxes
      $scope.$watch(function() {
        return $scope.checkboxes.items;
      }, function() {
        OverviewCheckboxUtil.dataCheckboxWatchCallback($scope);
      }, true);

      $scope.toggleShowAll = function() {
        $scope.showAll = !$scope.showAll;
        $scope.tableParams.reload();
      };

      $scope.selectAbo = function(abo, itemId) {
        var allRows = angular.element('#abosTable table tbody tr');
        allRows.removeClass('row-selected');

        if ($scope.selectedAbo === abo) {
          $scope.selectedAbo = undefined;
        } else {
          $scope.selectedAbo = abo;
          var row = angular.element('#' + itemId);
          row.addClass('row-selected');
        }
      };

      $scope.unselectAbo = function() {
        $scope.selectedAbo = undefined;
        var allRows = angular.element('#abosTable table tbody tr');
        allRows.removeClass('row-selected');
      };

      $scope.unselectAboFunct = function() {
        return $scope.unselectAbo;
      };

      if (!$scope.tableParams) {
        //use default tableParams
        $scope.tableParams = new NgTableParams({ // jshint ignore:line
          page: 1,
          count: 10,
          sorting: {
            id: 'asc'
          },
          filter: {
            abotypId: ''
          }
        }, {
          filterDelay: 0,
          groupOptions: {
            isExpanded: true
          },
          exportODSModel: AbosOverviewModel,
          exportODSFilter: function() {
            return {
              f: $scope.search.filterQuery
            };
          },
          getData: function(params) {
            if (!$scope.entries) {
              return;
            }
            // use build-in angular filter
            var dataSet = $filter('filter')($scope.entries, $scope.search.queryQuery);
            // also filter by ngtable filters
            dataSet = $filter('filter')(dataSet, params.filter());
            dataSet = params.sorting ?
              $filter('orderBy')(dataSet, params.orderBy(), false, localeSensitiveComparator) :
              dataSet;

            $scope.filteredEntries = dataSet;

            params.total(dataSet.length);
            return dataSet.slice((params.page() - 1) * params.count(),
              params.page() * params.count());
          }

        });
      }

      $scope.actions = [{
        labelFunction: function() {
          return gettext('Rechnungspositionen erstellen');
        },
        noEntityText: true,
        iconClass: 'glyphicon glyphicon-envelope',
        onExecute: function() {
          $scope.showCreateRechnungenDialog = true;
          return true;
        },
        isDisabled: function() {
          return !$scope.checkboxes.checkedAny;
        }
      }, {
        label: gettext('Email versenden'),
        noEntityText: true,
        iconClass: 'glyphicon glyphicon-envelope',
        onExecute: function() {
          var kundeIds = _($scope.filteredEntries)
            .keyBy('id')
            .at($scope.checkboxes.ids)
            .map('kundeId')
            .value();

          PersonenOverviewModel.query({
            f: 'kundeId=' + kundeIds + ';'
          }, function(personen) {
            var emailAddresses = _(personen)
              .map('email')
              .value();

            EmailUtil.toMailToBccLink(emailAddresses);
            return true;
          });
        },
        isDisabled: function() {
          return !$scope.checkboxes.checkedAny;
        }
      }];

      function search() {
        if ($scope.loading) {
          return;
        }
        $scope.loading = true;
        AbosOverviewModel.query({
          f: $scope.search.filterQuery
        }, function(entries) {
          $scope.entries = entries;
          $scope.tableParams.reload();
          $scope.loading = false;
          $location.search('q', $scope.search.query);
        });
      }

      var existingQuery = $location.search().q;
      if (existingQuery) {
        $scope.search.query = existingQuery;
      }

      $scope.closeCreateRechnungenDialog = function() {
        $scope.showCreateRechnungenDialog = false;
      };

      $scope.closeCreateRechnungenDialogFunct = function() {
        return $scope.closeCreateRechnungenDialog;
      };

      $scope.$watch('search.query', function() {
        $scope.search.filterQuery = FilterQueryUtil.transform($scope.search
          .query);
        $scope.search.queryQuery = FilterQueryUtil.withoutFilters($scope.search
          .query);
        search();
      }, true);
    }
  ]);

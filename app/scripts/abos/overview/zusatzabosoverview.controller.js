'use strict';

/**
 */
angular.module('openolitor-admin').controller('ZusatzabosOverviewController', [
  '$scope',
  '$filter',
  '$location',
  'ZusatzabosOverviewModel',
  'KundenOverviewModel',
  'NgTableParams',
  'ZusatzAbotypenOverviewModel',
  'FilterQueryUtil',
  'OverviewCheckboxUtil',
  'localeSensitiveComparator',
  'EmailUtil',
  'lodash',
  'PersonenOverviewModel',
  'gettext',
  'msgBus',
  'DetailNavigationService',
  function(
    $scope,
    $filter,
    $location,
    ZusatzabosOverviewModel,
    KundenOverviewModel,
    NgTableParams,
    ZusatzAbotypenOverviewModel,
    FilterQueryUtil,
    OverviewCheckboxUtil,
    localeSensitiveComparator,
    EmailUtil,
    _,
    PersonenOverviewModel,
    gettext,
    msgBus,
    DetailNavigationService
  ) {
    $scope.entries = [];
    $scope.filteredEntries = [];
    $scope.loading = false;
    $scope.selectedAbo = undefined;
    $scope.model = {};

    $scope.navigateToKunde = function(id) {
      $scope.filteredEntries = [];
      var listKundeIds = [];
      var currentKundeId = $filter('filter')(
        $scope.entries,
        { kundeId: id },
        true
      )[0];

      angular.forEach($scope.checkboxes.ids, function(id) {
        listKundeIds.push($scope.checkboxes.data[id].kundeId);
      });

      $scope.allEntries = KundenOverviewModel.query(
        {
          f: $scope.search.filterQuery
        },
        function() {
          $scope.loading = false;
          angular.forEach(listKundeIds, function(kundeId) {
            $scope.filteredEntries.push(
              $filter('filter')($scope.allEntries, { id: kundeId }, true)[0]
            );
          });
          DetailNavigationService.detailFromOverview(
            currentKundeId.kundeId,
            $scope,
            'kunden',
            $location.url()
          );
        }
      );
    };

    $scope.search = {
      query: '',
      queryQuery: '',
      filterQuery: '',
      complexFlags: {
        zusatzAbosAktiv: false
      }
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
    ZusatzAbotypenOverviewModel.query(
      {
        q: ''
      },
      function(list) {
        angular.forEach(list, function(abotyp) {
          $scope.abotypL.push({
            id: abotyp.id,
            title: abotyp.name
          });
        });
      }
    );

    // watch for check all checkbox
    $scope.$watch(
      function() {
        return $scope.checkboxes.checked;
      },
      function(value) {
        OverviewCheckboxUtil.checkboxWatchCallback($scope, value);
      }
    );

    // watch for data checkboxes
    $scope.$watch(
      function() {
        return $scope.checkboxes.items;
      },
      function() {
        OverviewCheckboxUtil.dataCheckboxWatchCallback($scope);
      },
      true
    );

    $scope.toggleShowAll = function() {
      $scope.showAll = !$scope.showAll;
      $scope.tableParams.reload();
    };

    $scope.selectZusatzAbo = function(abo, itemId) {
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

    $scope.unselectZusatzAbo = function() {
      $scope.selectedAbo = undefined;
      var allRows = angular.element('#abosTable table tbody tr');
      allRows.removeClass('row-selected');
    };

    $scope.unselectAboFunct = function() {
      return $scope.unselectZusatzAbo;
    };

    if (!$scope.tableParams) {
      //use default tableParams
      $scope.tableParams = new NgTableParams(
        {
          // jshint ignore:line
          page: 1,
          count: 10,
          sorting: {
            id: 'asc'
          },
          filter: {
            abotypId: '',
            aktiv: true
          }
        },
        {
          filterDelay: 0,
          groupOptions: {
            isExpanded: true
          },
          exportODSModel: ZusatzabosOverviewModel,
          exportODSFilter: function() {
            return {
              f: $scope.search.filterQuery,
              x: $scope.search.complexFlags
            };
          },
          getData: function(params) {
            if (!$scope.entries) {
              return;
            }
            // use build-in angular filter
            var dataSet = $filter('filter')(
              $scope.entries,
              $scope.search.queryQuery
            );
            // also filter by ngtable filters
            dataSet = $filter('filter')(dataSet, params.filter());
            dataSet = params.sorting
              ? $filter('orderBy')(
                  dataSet,
                  params.orderBy(),
                  false,
                  localeSensitiveComparator
                )
              : dataSet;

            // Add sortby attribute for ng-table. (ng-table can't sort on the result of a function)
            for (var i = 0; i < dataSet.length; i++) {
              var abo = dataSet[i];
              if (abo.depotId) {
                abo.depotTourSortBy = abo.depotName;
              } else {
                abo.depotTourSortBy = abo.tourName;
              }
            }

            $scope.filteredEntries = dataSet;

            params.total(dataSet.length);

            $location.search({
              q: $scope.search.query,
              f: JSON.stringify($scope.search.complexFlags),
              tf: JSON.stringify($scope.tableParams.filter())
            });

            return dataSet.slice(
              (params.page() - 1) * params.count(),
              params.page() * params.count()
            );
          }
        }
      );

      var existingFilter = $location.search().tf;
      if (existingFilter) {
        $scope.tableParams.filter(JSON.parse(existingFilter));
      }
    }

    $scope.actions = [
      {
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
      },
      {
        label: gettext('E-Mail versenden'),
        noEntityText: true,
        iconClass: 'glyphicon glyphicon-envelope',
        onExecute: function() {
          var kundeIds = _($scope.filteredEntries)
            .keyBy('id')
            .at(Object.keys($scope.checkboxes.items))
            .map('kundeId')
            .value();

          PersonenOverviewModel.query(
            {
              f: 'kundeId=' + kundeIds + ';'
            },
            function(personen) {
              var emailAddresses = _(personen)
                .map('email')
                .value();

              EmailUtil.toMailToBccLink(emailAddresses);
              return true;
            }
          );
        },
        isDisabled: function() {
          return !$scope.checkboxes.checkedAny;
        }
      },
      {
        label: gettext('E-Mail Formular'),
        noEntityText: true,
        iconClass: 'glyphicon glyphicon-pencil',
        onExecute: function() {
          $scope.$broadcast('resetDirectiveEmailDialog');
          $scope.entity = gettext('abo');
          $scope.url = 'mailing/sendEmailToAbosSubscribers';
          $scope.message = gettext(
            'Wenn Sie folgende Label einfügen, werden sie durch den entsprechenden Wert ersetzt: \n {{person.anrede}} \n {{person.vorname}} \n {{person.name}} \n {{person.rolle}} \n {{person.kundeId}} \n {{abo.abotypName}} \n {{abo.kunde}} \n {{abo.start}} \n {{abo.ende}}'
          );
          $scope.aboIdsMailing = _($scope.filteredEntries)
            .keyBy('id')
            .at(Object.keys($scope.checkboxes.items))
            .map('id')
            .value();
          $scope.showCreateEMailDialog = true;
          return true;
        },
        isDisabled: function() {
          return !$scope.checkboxes.checkedAny;
        }
      }
    ];

    function search() {
      if ($scope.loading) {
        return;
      }
      $scope.loading = true;
      ZusatzabosOverviewModel.query(
        {
          f: $scope.search.filterQuery,
          x: $scope.search.complexFlags
        },
        function(entries) {
          $scope.entries = entries;
          $scope.tableParams.reload();
          $scope.loading = false;
        }
      );
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

    $scope.closeCreateEMailDialog = function() {
      $scope.showCreateEMailDialog = false;
    };

    $scope.closeCreateEMailDialogFunct = function() {
      return $scope.closeCreateEMailDialog;
    };

    $scope.$watchGroup(
      ['search.query', 'search.complexFlags.zusatzAbosAktiv'],
      function() {
        $scope.search.filterQuery = FilterQueryUtil.transform(
          $scope.search.query
        );
        $scope.search.queryQuery = FilterQueryUtil.withoutFilters(
          $scope.search.query
        );
        search();
      },
      true
    );

    msgBus.onMsg('EntityModified', $scope, function(event, msg) {
      if (msg.entity.indexOf('Abo') >= 0) {
        $scope.entries.map(function(entry) {
          if (entry.id === msg.data.id) {
            angular.copy(msg.data, entry);
          }
        });
        $scope.$apply();
      }
    });
  }
]);

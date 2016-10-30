/**
 * TMDB API for fetching images
 *
 * For API docs: check here: https://developers.themoviedb.org/3
 */
DuckieTV.factory('TMDB', ["SettingsService", "$q", "$http", function(SettingsService, $q, $http) {
  var APIUrl = "https://api.themoviedb.org/3";
  // Allow a custom user API key or our own. NOTE: Put API key here for testing
  var APIKey = SettingsService.get('tmdb.api_key') || "";
  var endpoints = {
    config: APIUrl + "/configuration?api_key=" + APIKey,
    serie: APIUrl + "/tv/%s/images?language=en&api_key=" + APIKey,
    season: APIUrl + "/tv/%s/season/%s/images?language=en&api_key=" + APIKey,
    episode: APIUrl + "/tv/%s/season/%s/episode/%s/images?language=en&api_key=" + APIKey
  };

  var base_url = localStorage.getItem('tmdb.base_url');
  var sizes = localStorage.getItem('tmdb.sizes');
  var lastUpdate = localStorage.getItem('tmdb.lastUpdate');
  sizes = sizes ? angular.fromJson(sizes) : undefined;

  var getUrl = function(type, serie, season, episode) {
    var url = endpoints[type].replace('%s', serie).replace('%s', season).replace('%s', episode);
    return url;
  };

  var getImgUrl = function(id, type) {
    if (base_url && sizes) {
      return base_url + sizes[type] + id;
    }
  };

  var getImages = function(type, serie, season, episode) {
    return $http.get(getUrl(type, serie, season, episode)).then(function(response) {
      var data = response.data;
      var posters = data.posters.sort(function(a, b) { // sort by votes
        return b.vote_count - a.vote_count;
      });
      var backdrops = data.backdrops.sort(function(a, b) { // sort by votes
        return b.vote_count - a.vote_count;
      });
      return {
        poster: getImgUrl(posters[0].file_path, 'poster'),
        backdrop: getImgUrl(backdrops[0].file_path, 'backdrop')
      };
    });
  };

  var service = {
    getConfig: function() {
      $http.get(getUrl('config')).then(function(response) {
        var data = response.data.images;
        var bUrl = data.secure_base_url;
        var bSize = data.backdrop_sizes[data.backdrop_sizes.indexOf('original')] || data.backdrop_sizes[data.backdrop_sizes.length - 1];
        var sSize = data.still_sizes[data.still_sizes.indexOf('w300')] || data.still_sizes[data.still_sizes.length - 2];
        var pSize = data.poster_sizes[data.poster_sizes.indexOf('w342')] || data.poster_sizes[data.poster_sizes.length - 2];
        if (bUrl && bSize && sSize && pSize) {
          localStorage.setItem('tmdb.base_url', bUrl);
          localStorage.setItem('tmdb.sizes', angular.toJson({
            poster: pSize,
            backdrop: bSize,
            still: sSize
          }));
          localStorage.setItem('tmdb.lastUpdate', Date.now());
        } else {
          console.error("Error fetching TMDB Configuration, missing data?", response.data);
        }
      }, function(error) {
        console.error("Error fetching TMDB Configuration", error);
      });
    },
    getSerieImages: function(serie) {
      return getImages('serie', serie);
    },
    getSeasonImages: function(serie, season) {
      return getImages('serie', serie, season);
    },
    getEpisodeImages: function(serie, season, episode) {
      return getImages('serie', serie, season, episode);
    }
  };

  if (!base_url || !sizes || Date.now() > lastUpdate * 1000 * 60 * 60 * 24 * 7) {
    console.info("Fetching new TMDB configuration");
    service.getConfig();
  }

  service.getSerieImages('62413').then(function(images) {
    console.log("Done", images)
  })

  return service;
}]);

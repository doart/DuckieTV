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
    // Returns Serie Poster & BG as well as Posters for every season
    serie: APIUrl + "/tv/%s?language=en&api_key=" + APIKey,
    // Season number and episode number, IDs not required
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

  var promiseStack = [];
  var processing = false;
  var limitRemaining = 40;
  var requestQueue = function(data) {
    return new Promise(function(resolve, reject) {
      function newPromise(url, resolve, reject, attempted) {
        return function() {
          limitRemaining--;
          $http.get(url).then(function(response) {
            resolve(response.data);
          }, function(error) { // Try again on error
            if (attempted || error.status != 429) {
              return reject(error);
            }
            setTimeout(function () {
              promiseStack.push(newPromise(data, resolve, reject, true));
              if (!processing) {
                processQueue();
              }
            }, 500);
          });
        };
      }

      promiseStack.push(newPromise(data, resolve, reject));
      if (!processing) {
        processQueue();
      }
    });
  };

  var processQueue = function() {
    processing = true;
    if (limitRemaining === 40) {
      // kick off timer to reset limitRemaining in 10.5 secs
      setTimeout(function() {
        limitRemaining = 40;
      }, 10500);
    }

    if (limitRemaining > 0) {
      var nextPromise = promiseStack.shift();
      if (nextPromise) {
        nextPromise();
        setTimeout(function () {
          processQueue();
        }, 1);
      } else {
        processing = false;
      }
    } else {
      // limit reached, try again in half a sec
      setTimeout(function () {
        processQueue();
      }, 500);
    }
  };

  var getImages = function(type, serie, season, episode) {
    return new Promise(function(resolve) {
      if (!serie || (type == 'episode' && (!episode || !season))) {
        console.error("Missing TMDB ID", serie, season, episode);
        return resolve({
          poster: null,
          backdrop: null,
          seasons: []
        });
      }
      requestQueue(getUrl(type, serie, season, episode)).then(function(data) {
        if (type == 'episode') {
          return resolve({ still: service.getImgUrl(data.still_path, 'still') });
        }
        var seasons = {};
        data.seasons.forEach(function(s) {
          seasons[s.season_number] = service.getImgUrl(s.poster_path, 'poster');
        });
        resolve({
          poster: service.getImgUrl(data.poster_path, 'poster'),
          backdrop: service.getImgUrl(data.backdrop_path, 'backdrop'),
          seasons: seasons
        });
      }).catch(function(error) {
        console.error("Error fetching images for", serie, error);
        resolve({
          poster: null,
          backdrop: null,
          seasons: []
        });
      });
    });
  };

  var service = {
    // Returns an images URL for its ID and type
    getImgUrl: function(id, type) {
      if (!id || !base_url || !sizes) return null;
      return base_url + sizes[type] + id;
    },
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
    // Serie images returns a series poster and backdrop as well as all season posters
    getSerieImages: function(serieID) {
      return getImages('serie', serieID);
    },
    getEpisodeImages: function(serieID, seasonID, episodeID) {
      return getImages('episode', serieID, seasonID, episodeID);
    }
  };

  if (!base_url || !sizes || Date.now() > lastUpdate * 1000 * 60 * 60 * 24 * 7) {
    console.info("Fetching new TMDB configuration");
    service.getConfig();
  }

  return service;
}]);

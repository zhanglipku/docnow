'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Database = undefined;

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _from = require('babel-runtime/core-js/array/from');

var _from2 = _interopRequireDefault(_from);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _v = require('uuid/v4');

var _v2 = _interopRequireDefault(_v);

var _elasticsearch = require('elasticsearch');

var _elasticsearch2 = _interopRequireDefault(_elasticsearch);

var _redis = require('./redis');

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _twitter = require('./twitter');

var _urlFetcher = require('./url-fetcher');

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// elasticsearch doc types

var SETTINGS = 'settings';
var USER = 'user';
var PLACE = 'place';
var SEARCH = 'search';
var TREND = 'trend';
var TWEET = 'tweet';
var TWUSER = 'twuser';

var urlFetcher = new _urlFetcher.UrlFetcher();

var Database = exports.Database = function () {
  function Database() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck3.default)(this, Database);

    // setup redis
    this.redis = (0, _redis.getRedis)();

    // setup elasticsearch
    var esOpts = opts.es || {};
    esOpts.host = esOpts.host || process.env.ES_HOST || '127.0.0.1:9200';
    _logger2.default.info('connecting to elasticsearch:', esOpts);
    this.esPrefix = esOpts.prefix || 'docnow';
    this.es = new _elasticsearch2.default.Client(esOpts);
  }

  (0, _createClass3.default)(Database, [{
    key: 'getIndex',
    value: function getIndex(type) {
      return this.esPrefix + '-' + type;
    }
  }, {
    key: 'close',
    value: function close() {
      this.redis.quit();
      urlFetcher.stop();
    }
  }, {
    key: 'clear',
    value: function clear() {
      var _this = this;

      return new _promise2.default(function (resolve, reject) {
        _this.redis.flushdbAsync().then(function (didSucceed) {
          if (didSucceed === 'OK') {
            _this.deleteIndexes().then(resolve).catch(reject);
          } else {
            reject('redis flushdb failed');
          }
        });
      });
    }
  }, {
    key: 'add',
    value: function add(type, id, doc) {
      var _this2 = this;

      _logger2.default.debug('update ' + type + ' ' + id, doc);
      return new _promise2.default(function (resolve, reject) {
        _this2.es.index({
          index: _this2.getIndex(type),
          type: type,
          id: id,
          body: doc,
          refresh: 'wait_for'
        }).then(function () {
          resolve(doc);
        }).catch(reject);
      });
    }
  }, {
    key: 'get',
    value: function get(type, id) {
      var _this3 = this;

      _logger2.default.debug('get type=' + type + ' id=' + id);
      return new _promise2.default(function (resolve, reject) {
        _this3.es.get({
          index: _this3.getIndex(type),
          type: type,
          id: id
        }).then(function (result) {
          resolve(result._source);
        }).catch(function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: 'search',
    value: function search(type, q) {
      var _this4 = this;

      var first = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      _logger2.default.debug('search', type, q, first);
      var size = first ? 1 : 1000;
      return new _promise2.default(function (resolve, reject) {
        _this4.es.search({ index: _this4.getIndex(type), type: type, q: q, size: size }).then(function (result) {
          if (result.hits.total > 0) {
            if (first) {
              resolve(result.hits.hits[0]._source);
            } else {
              resolve(result.hits.hits.map(function (h) {
                return h._source;
              }));
            }
          } else if (first) {
            resolve(null);
          } else {
            resolve([]);
          }
        }).catch(reject);
      });
    }
  }, {
    key: 'addSettings',
    value: function addSettings(settings) {
      return this.add(SETTINGS, 'settings', settings);
    }
  }, {
    key: 'getSettings',
    value: function getSettings() {
      var _this5 = this;

      return new _promise2.default(function (resolve) {
        _this5.get(SETTINGS, 'settings').then(function (settings) {
          resolve(settings);
        }).catch(function () {
          resolve({});
        });
      });
    }
  }, {
    key: 'addUser',
    value: function addUser(user) {
      var _this6 = this;

      user.id = (0, _v2.default)();
      user.places = [];
      _logger2.default.info('creating user: ', { user: user });
      return new _promise2.default(function (resolve) {
        _this6.getSuperUser().then(function (u) {
          user.isSuperUser = u ? false : true;
          _this6.add(USER, user.id, user).then(function () {
            if (user.isSuperUser) {
              _this6.loadPlaces().then(function () {
                resolve(user);
              });
            } else {
              resolve(user);
            }
          });
        });
      });
    }
  }, {
    key: 'updateUser',
    value: function updateUser(user) {
      return this.add(USER, user.id, user);
    }
  }, {
    key: 'getUser',
    value: function getUser(userId) {
      return this.get(USER, userId);
    }
  }, {
    key: 'getUsers',
    value: function getUsers() {
      return this.search(USER, '*');
    }
  }, {
    key: 'getSuperUser',
    value: function getSuperUser() {
      return this.search(USER, 'isSuperUser:true', true);
    }
  }, {
    key: 'getUserByTwitterUserId',
    value: function getUserByTwitterUserId(twitterUserId) {
      return this.search(USER, 'twitterUserId:' + twitterUserId, true);
    }
  }, {
    key: 'importLatestTrends',
    value: function importLatestTrends() {
      var _this7 = this;

      _logger2.default.debug('importing trends');
      return new _promise2.default(function (resolve) {
        _this7.getUsers().then(function (users) {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = (0, _getIterator3.default)(users), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var user = _step.value;

              _this7.importLatestTrendsForUser(user).then(resolve);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }).catch(function () {
          _logger2.default.info('no users to import trends for');
          resolve();
        });
      });
    }
  }, {
    key: 'importLatestTrendsForUser',
    value: function importLatestTrendsForUser(user) {
      var _this8 = this;

      _logger2.default.debug('importing trends', { user: user });
      return new _promise2.default(function (resolve, reject) {
        _this8.getTwitterClientForUser(user).then(function (twtr) {
          var placeIds = user.places.map(_utils.stripPrefix);
          if (placeIds.length === 0) {
            resolve([]);
          } else {
            _logger2.default.info('importing trends for ', { placeIds: placeIds });
            _promise2.default.all(placeIds.map(twtr.getTrendsAtPlace, twtr)).then(_this8.saveTrends.bind(_this8)).then(resolve);
          }
        }).catch(reject);
      });
    }
  }, {
    key: 'startTrendsWatcher',
    value: function startTrendsWatcher() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _logger2.default.info('starting trend watcher');
      this.importLatestTrends();
      this.trendsWatcherId = setInterval(this.importLatestTrends.bind(this), opts.interval || 60 * 1000);
    }
  }, {
    key: 'stopTrendsWatcher',
    value: function stopTrendsWatcher() {
      _logger2.default.info('stopping trend watcher');
      if (this.trendsWatcherId) {
        clearInterval(this.trendsWatcherId);
        this.trendsWatcherId = null;
      }
    }
  }, {
    key: 'getTrendsForPlace',
    value: function getTrendsForPlace(placeId) {
      var _this9 = this;

      return new _promise2.default(function (resolve) {
        _this9.search('trend', 'placeId:' + placeId, true).then(function (results) {
          var filtered = results.trends.filter(function (t) {
            return t.tweets > 0;
          });
          filtered.sort(function (a, b) {
            return b.tweets - a.tweets;
          });
          results.trends = filtered;
          resolve(results);
        });
      });
    }
  }, {
    key: 'getUserTrends',
    value: function getUserTrends(user) {
      if (user && user.places) {
        return _promise2.default.all(user.places.map(this.getTrendsForPlace, this));
      }
    }
  }, {
    key: 'saveTrends',
    value: function saveTrends(trends) {
      var _this10 = this;

      var body = [];
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = (0, _getIterator3.default)(trends), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var trend = _step2.value;

          trend.id = (0, _utils.addPrefix)('trend', trend.id);
          trend.placeId = (0, _utils.addPrefix)('place', (0, _utils.stripPrefix)(trend.id));
          body.push({
            index: {
              _index: this.getIndex(TREND),
              _type: 'trend',
              _id: trend.id
            },
            refresh: 'wait_for'
          }, trend);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return new _promise2.default(function (resolve, reject) {
        _this10.es.bulk({ body: body, refresh: 'wait_for' }).then(function () {
          resolve(trends);
        }).catch(function (err) {
          _logger2.default.error('bulk insert failed', err);
          reject(err);
        });
      });
    }
  }, {
    key: 'loadPlaces',
    value: function loadPlaces() {
      var _this11 = this;

      return new _promise2.default(function (resolve, reject) {
        _this11.getSuperUser().then(function (user) {
          _this11.getTwitterClientForUser(user).then(function (t) {
            t.getPlaces().then(function (places) {

              // bulk insert all the places as separate
              // documents in elasticsearch

              var body = [];
              var _iteratorNormalCompletion3 = true;
              var _didIteratorError3 = false;
              var _iteratorError3 = undefined;

              try {
                for (var _iterator3 = (0, _getIterator3.default)(places), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                  var place = _step3.value;

                  place.id = (0, _utils.addPrefix)('place', place.id);
                  place.parentId = (0, _utils.addPrefix)('place', place.parent);
                  delete place.parent;
                  body.push({
                    index: {
                      _index: _this11.getIndex(PLACE),
                      _type: 'place',
                      _id: place.id
                    }
                  });
                  body.push(place);
                }
              } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion3 && _iterator3.return) {
                    _iterator3.return();
                  }
                } finally {
                  if (_didIteratorError3) {
                    throw _iteratorError3;
                  }
                }
              }

              _this11.es.bulk({ body: body, refresh: 'wait_for' }).then(function () {
                resolve(places);
              }).catch(reject);
            });
          }).catch(reject);
        }).catch(reject);
      });
    }
  }, {
    key: 'getPlace',
    value: function getPlace(placeId) {
      return this.search(PLACE, placeId, true);
    }
  }, {
    key: 'getPlaces',
    value: function getPlaces() {
      return this.search(PLACE, '*');
    }
  }, {
    key: 'getTwitterClientForUser',
    value: function getTwitterClientForUser(user) {
      var _this12 = this;

      return new _promise2.default(function (resolve) {
        _this12.getSettings().then(function (settings) {
          resolve(new _twitter.Twitter({
            consumerKey: settings.appKey,
            consumerSecret: settings.appSecret,
            accessToken: user.twitterAccessToken,
            accessTokenSecret: user.twitterAccessTokenSecret
          }));
        });
      });
    }
  }, {
    key: 'createSearch',
    value: function createSearch(user, query) {
      var _this13 = this;

      return new _promise2.default(function (resolve, reject) {
        var search = {
          id: (0, _v2.default)(),
          creator: user.id,
          query: query,
          created: new Date().toISOString(),
          updated: new Date(),
          maxTweetId: null,
          active: true
        };
        _this13.es.create({
          index: _this13.getIndex(SEARCH),
          type: SEARCH,
          id: search.id,
          body: search
        }).then(function () {
          resolve(search);
        }).catch(function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: 'getUserSearches',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(user) {
        var body, resp;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                // const body = {query: {match: {creator: user.id, saved: true}}}
                body = {
                  query: {
                    bool: {
                      must: [{ match: { creator: user.id } }, { match: { saved: true } }]
                    }
                  },
                  sort: [{ created: 'desc' }]
                };
                _context.next = 3;
                return this.es.search({
                  index: this.getIndex(SEARCH),
                  type: SEARCH,
                  body: body
                });

              case 3:
                resp = _context.sent;
                return _context.abrupt('return', resp.hits.hits.map(function (h) {
                  return h._source;
                }));

              case 5:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function getUserSearches(_x4) {
        return _ref.apply(this, arguments);
      }

      return getUserSearches;
    }()
  }, {
    key: 'getSearch',
    value: function getSearch(searchId) {
      return this.get(SEARCH, searchId);
    }
  }, {
    key: 'updateSearch',
    value: function updateSearch(search) {
      search.updated = new Date();
      return this.add(SEARCH, search.id, search);
    }
  }, {
    key: 'getSearchSummary',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(search) {
        var body, resp, userCount, videoCount, imageCount, urlCount;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                body = {
                  query: {
                    match: {
                      search: search.id
                    }
                  },
                  aggregations: {
                    minDate: { min: { field: 'created' } },
                    maxDate: { max: { field: 'created' } }
                  }
                };
                _context2.next = 3;
                return this.es.search({
                  index: this.getIndex(TWEET),
                  type: TWEET,
                  body: body
                });

              case 3:
                resp = _context2.sent;
                _context2.next = 6;
                return this.redis.zcardAsync((0, _redis.usersCountKey)(search));

              case 6:
                userCount = _context2.sent;
                _context2.next = 9;
                return this.redis.zcardAsync((0, _redis.videosCountKey)(search));

              case 9:
                videoCount = _context2.sent;
                _context2.next = 12;
                return this.redis.zcardAsync((0, _redis.imagesCountKey)(search));

              case 12:
                imageCount = _context2.sent;
                _context2.next = 15;
                return this.redis.zcardAsync((0, _redis.urlsKey)(search));

              case 15:
                urlCount = _context2.sent;
                return _context2.abrupt('return', (0, _extends3.default)({}, search, {
                  minDate: new Date(resp.aggregations.minDate.value),
                  maxDate: new Date(resp.aggregations.maxDate.value),
                  tweetCount: resp.hits.total,
                  imageCount: imageCount,
                  videoCount: videoCount,
                  userCount: userCount,
                  urlCount: urlCount
                }));

              case 17:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function getSearchSummary(_x5) {
        return _ref2.apply(this, arguments);
      }

      return getSearchSummary;
    }()
  }, {
    key: 'importFromSearch',
    value: function importFromSearch(search) {
      var _this14 = this;

      var maxTweets = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;

      var count = 0;
      var totalCount = search.count || 0;
      var maxTweetId = null;

      var queryParts = [];
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = (0, _getIterator3.default)(search.query), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var term = _step4.value;

          if (term.type === 'keyword') {
            queryParts.push(term.value);
          } else if (term.type === 'user') {
            queryParts.push('@' + term.value);
          } else if (term.type === 'phrase') {
            queryParts.push('"' + term.value + '"');
          } else if (term.type === 'hashtag') {
            queryParts.push(term.value);
          } else {
            _logger2.default.warn('search is missing a type: ', search);
            queryParts.push(term.value);
          }
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      var q = queryParts.join(' OR ');

      return new _promise2.default(function (resolve, reject) {
        _this14.getUser(search.creator).then(function (user) {
          _this14.updateSearch((0, _extends3.default)({}, search, { active: true })).then(function (newSearch) {
            _this14.getTwitterClientForUser(user).then(function (twtr) {
              twtr.search({ q: q, sinceId: search.maxTweetId, count: maxTweets }, function (err, results) {
                if (err) {
                  reject(err);
                } else if (results.length === 0) {
                  newSearch.count = totalCount;
                  newSearch.maxTweetId = maxTweetId;
                  newSearch.active = false;
                  _this14.updateSearch(newSearch).then(function () {
                    resolve(count);
                  });
                } else {
                  count += results.length;
                  totalCount += results.length;
                  if (maxTweetId === null) {
                    maxTweetId = results[0].id;
                  }
                  var bulk = [];
                  var seenUsers = new _set2.default();
                  var _iteratorNormalCompletion5 = true;
                  var _didIteratorError5 = false;
                  var _iteratorError5 = undefined;

                  try {
                    for (var _iterator5 = (0, _getIterator3.default)(results), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                      var tweet = _step5.value;


                      _this14.tallyTweet(search, tweet);

                      var _iteratorNormalCompletion6 = true;
                      var _didIteratorError6 = false;
                      var _iteratorError6 = undefined;

                      try {
                        for (var _iterator6 = (0, _getIterator3.default)(tweet.urls), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                          var url = _step6.value;

                          urlFetcher.add(search, url.long, tweet.id);
                        }
                      } catch (err) {
                        _didIteratorError6 = true;
                        _iteratorError6 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion6 && _iterator6.return) {
                            _iterator6.return();
                          }
                        } finally {
                          if (_didIteratorError6) {
                            throw _iteratorError6;
                          }
                        }
                      }

                      tweet.search = search.id;
                      var id = search.id + ':' + tweet.id;
                      bulk.push({
                        index: {
                          _index: _this14.getIndex(TWEET),
                          _type: 'tweet',
                          _id: id
                        }
                      }, tweet);
                      if (!seenUsers.has(tweet.user.id)) {
                        bulk.push({
                          index: {
                            _index: _this14.getIndex(TWUSER),
                            _type: 'twuser',
                            _id: tweet.user.id
                          }
                        }, tweet.user);
                        seenUsers.add(tweet.user.id);
                      }
                    }
                  } catch (err) {
                    _didIteratorError5 = true;
                    _iteratorError5 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion5 && _iterator5.return) {
                        _iterator5.return();
                      }
                    } finally {
                      if (_didIteratorError5) {
                        throw _iteratorError5;
                      }
                    }
                  }

                  _this14.es.bulk({
                    body: bulk,
                    refresh: 'wait_for'
                  }).then(function (resp) {
                    if (resp.errors) {
                      reject('indexing error check elasticsearch log');
                    }
                  }).catch(function (elasticErr) {
                    _logger2.default.error(elasticErr.message);
                    reject(elasticErr.message);
                  });
                }
              });
            });
          }).catch(function (e) {
            _logger2.default.error('unable to update search: ', e);
          });
        });
      });
    }
  }, {
    key: 'tallyTweet',
    value: function tallyTweet(search, tweet) {
      this.redis.incr((0, _redis.tweetsCountKey)(search));
      this.redis.zincrby((0, _redis.usersCountKey)(search), 1, tweet.user.screenName);
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = (0, _getIterator3.default)(tweet.videos), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var video = _step7.value;

          this.redis.zincrby((0, _redis.videosCountKey)(search), 1, video);
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }

      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = (0, _getIterator3.default)(tweet.images), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var image = _step8.value;

          this.redis.zincrby((0, _redis.imagesCountKey)(search), 1, image);
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8.return) {
            _iterator8.return();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }
    }
  }, {
    key: 'getTweets',
    value: function getTweets(search) {
      var _this15 = this;

      var includeRetweets = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

      var body = {
        size: 100,
        query: {
          bool: {
            must: {
              term: {
                search: search.id
              }
            },
            must_not: {
              exists: {
                field: 'retweet'
              }
            }
          }
        },
        sort: {
          created: 'desc'
        }

        // adjust the query and sorting if they don't want retweets
      };if (!includeRetweets) {
        body.query.bool.must_not = { exists: { field: 'retweet' } };
        body.sort = [{ retweetCount: 'desc' }, { created: 'desc' }];
      }

      return new _promise2.default(function (resolve, reject) {
        _this15.es.search({
          index: _this15.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          resolve(response.hits.hits.map(function (h) {
            return h._source;
          }));
        }).catch(function (err) {
          _logger2.default.error(err);
          reject(err);
        });
      });
    }
  }, {
    key: 'getTweetsForUrl',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(search, url) {
        var ids, body, resp;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return urlFetcher.getTweetIdentifiers(search, url);

              case 2:
                ids = _context3.sent;
                body = {
                  size: 100,
                  query: {
                    bool: {
                      must: [{ match: { search: search.id } }],
                      filter: { terms: { id: ids } }
                    }
                  },
                  sort: [{ id: 'desc' }]
                };
                _context3.next = 6;
                return this.es.search({
                  index: this.getIndex(TWEET),
                  type: TWEET,
                  body: body
                });

              case 6:
                resp = _context3.sent;
                return _context3.abrupt('return', resp.hits.hits.map(function (h) {
                  return h._source;
                }));

              case 8:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function getTweetsForUrl(_x8, _x9) {
        return _ref3.apply(this, arguments);
      }

      return getTweetsForUrl;
    }()
  }, {
    key: 'getTwitterUsers',
    value: function getTwitterUsers(search) {
      var _this16 = this;

      // first get the user counts for tweets

      var body = {
        query: { match: { search: search.id } },
        aggregations: { users: { terms: { field: 'user.screenName', size: 100 } } }
      };
      return new _promise2.default(function (resolve, reject) {
        _this16.es.search({
          index: _this16.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response1) {

          // with the list of users get the user information for them
          var counts = new _map2.default();
          var buckets = response1.aggregations.users.buckets;
          buckets.map(function (c) {
            counts.set(c.key, c.doc_count);
          });
          var screenNames = (0, _from2.default)(counts.keys());

          body = {
            size: 100,
            query: {
              constant_score: {
                filter: {
                  terms: {
                    'screenName': screenNames
                  }
                }
              }
            }
          };
          _this16.es.search({
            index: _this16.getIndex(TWUSER),
            type: TWUSER,
            body: body
          }).then(function (response2) {
            var users = response2.hits.hits.map(function (h) {
              return h._source;
            });

            // add the tweet counts per user that we got previously
            var _iteratorNormalCompletion9 = true;
            var _didIteratorError9 = false;
            var _iteratorError9 = undefined;

            try {
              for (var _iterator9 = (0, _getIterator3.default)(users), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
                var user = _step9.value;

                user.tweetsInSearch = counts.get(user.screenName);
              }

              // sort them by their counts
            } catch (err) {
              _didIteratorError9 = true;
              _iteratorError9 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion9 && _iterator9.return) {
                  _iterator9.return();
                }
              } finally {
                if (_didIteratorError9) {
                  throw _iteratorError9;
                }
              }
            }

            users.sort(function (a, b) {
              return b.tweetsInSearch - a.tweetsInSearch;
            });
            resolve(users);
          });
        }).catch(function (err) {
          _logger2.default.error(err);
          reject(err);
        });
      });
    }
  }, {
    key: 'getHashtags',
    value: function getHashtags(search) {
      var _this17 = this;

      var body = {
        size: 0,
        query: { match: { search: search.id } },
        aggregations: { hashtags: { terms: { field: 'hashtags', size: 100 } } }
      };
      return new _promise2.default(function (resolve, reject) {
        _this17.es.search({
          index: _this17.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var hashtags = response.aggregations.hashtags.buckets.map(function (ht) {
            return { hashtag: ht.key, count: ht.doc_count };
          });
          resolve(hashtags);
        }).catch(function (err) {
          _logger2.default.error(err);
          reject(err);
        });
      });
    }
  }, {
    key: 'getUrls',
    value: function getUrls(search) {
      var _this18 = this;

      var body = {
        size: 0,
        query: { match: { search: search.id } },
        aggregations: { urls: { terms: { field: 'urls.long', size: 100 } } }
      };
      return new _promise2.default(function (resolve, reject) {
        _this18.es.search({
          index: _this18.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var urls = response.aggregations.urls.buckets.map(function (u) {
            return { url: u.key, count: u.doc_count };
          });
          resolve(urls);
        }).catch(function (err) {
          _logger2.default.error(err);
          reject(err);
        });
      });
    }
  }, {
    key: 'getImages',
    value: function getImages(search) {
      var _this19 = this;

      var body = {
        size: 0,
        query: { match: { search: search.id } },
        aggregations: { images: { terms: { field: 'images', size: 100 } } }
      };
      return new _promise2.default(function (resolve, reject) {
        _this19.es.search({
          index: _this19.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var images = response.aggregations.images.buckets.map(function (u) {
            return { url: u.key, count: u.doc_count };
          });
          resolve(images);
        }).catch(function (err) {
          _logger2.default.error(err);
          reject(err);
        });
      });
    }
  }, {
    key: 'getVideos',
    value: function getVideos(search) {
      var _this20 = this;

      var body = {
        size: 0,
        query: { match: { search: search.id } },
        aggregations: { videos: { terms: { field: 'videos', size: 100 } } }
      };
      return new _promise2.default(function (resolve, reject) {
        _this20.es.search({
          index: _this20.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var videos = response.aggregations.videos.buckets.map(function (u) {
            return { url: u.key, count: u.doc_count };
          });
          resolve(videos);
        }).catch(function (err) {
          _logger2.default.error(err);
          reject(err);
        });
      });
    }
  }, {
    key: 'addUrl',
    value: function addUrl(search, url) {
      var job = { url: url, search: search };
      return this.redis.lpushAsync('urlqueue', (0, _stringify2.default)(job));
    }
  }, {
    key: 'processUrl',
    value: function processUrl() {
      var _this21 = this;

      return new _promise2.default(function (resolve, reject) {
        _this21.redis.blpopAsync('urlqueue', 0).then(function (result) {
          var job = JSON.parse(result[1]);
          resolve({
            url: job.url,
            title: 'Twitter'
          });
        }).catch(function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: 'getWebpages',
    value: function getWebpages(search) {
      return urlFetcher.getWebpages(search);
    }
  }, {
    key: 'queueStats',
    value: function queueStats(search) {
      return urlFetcher.queueStats(search);
    }
  }, {
    key: 'selectWebpage',
    value: function selectWebpage(search, url) {
      return urlFetcher.selectWebpage(search, url);
    }
  }, {
    key: 'deselectWebpage',
    value: function deselectWebpage(search, url) {
      return urlFetcher.deselectWebpage(search, url);
    }

    /* elastic search index management */

  }, {
    key: 'setupIndexes',
    value: function setupIndexes() {
      var _this22 = this;

      return this.es.indices.exists({ index: this.getIndex(TWEET) }).then(function (exists) {
        if (!exists) {
          _logger2.default.info('adding indexes');
          _this22.addIndexes();
        } else {
          _logger2.default.warn('indexes already present, not adding');
        }
      }).catch(function (e) {
        _logger2.default.error(e);
      });
    }
  }, {
    key: 'addIndexes',
    value: function addIndexes() {
      var indexMappings = this.getIndexMappings();
      var promises = [];
      var _iteratorNormalCompletion10 = true;
      var _didIteratorError10 = false;
      var _iteratorError10 = undefined;

      try {
        for (var _iterator10 = (0, _getIterator3.default)((0, _keys2.default)(indexMappings)), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
          var name = _step10.value;

          promises.push(this.addIndex(name, indexMappings[name]));
        }
      } catch (err) {
        _didIteratorError10 = true;
        _iteratorError10 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion10 && _iterator10.return) {
            _iterator10.return();
          }
        } finally {
          if (_didIteratorError10) {
            throw _iteratorError10;
          }
        }
      }

      return _promise2.default.all(promises);
    }
  }, {
    key: 'addIndex',
    value: function addIndex(name, map) {
      var prefixedName = this.getIndex(name);
      var body = { mappings: {} };
      body.mappings[name] = map;
      _logger2.default.info('creating index: ' + prefixedName);
      return this.es.indices.create({
        index: prefixedName,
        body: body
      });
    }
  }, {
    key: 'updateIndexes',
    value: function updateIndexes() {
      var indexMappings = this.getIndexMappings();
      var promises = [];
      var _iteratorNormalCompletion11 = true;
      var _didIteratorError11 = false;
      var _iteratorError11 = undefined;

      try {
        for (var _iterator11 = (0, _getIterator3.default)((0, _keys2.default)(indexMappings)), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
          var name = _step11.value;

          promises.push(this.updateIndex(name, indexMappings[name]));
        }
      } catch (err) {
        _didIteratorError11 = true;
        _iteratorError11 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion11 && _iterator11.return) {
            _iterator11.return();
          }
        } finally {
          if (_didIteratorError11) {
            throw _iteratorError11;
          }
        }
      }

      return _promise2.default.all(promises);
    }
  }, {
    key: 'updateIndex',
    value: function updateIndex(name, map) {
      var prefixedName = this.getIndex(name);
      _logger2.default.info('updating index: ' + prefixedName);
      return this.es.indices.putMapping({
        index: prefixedName,
        type: name,
        body: map
      });
    }
  }, {
    key: 'deleteIndexes',
    value: function deleteIndexes() {
      var _this23 = this;

      _logger2.default.info('deleting all elasticsearch indexes');
      return new _promise2.default(function (resolve) {
        _this23.es.indices.delete({ index: _this23.esPrefix + '*' }).then(function () {
          _logger2.default.info('deleted indexes');
          resolve();
        }).catch(function (err) {
          _logger2.default.warn('indexes delete failed: ' + err);
          resolve();
        });
      });
    }
  }, {
    key: 'getIndexMappings',
    value: function getIndexMappings() {
      return {

        settings: {
          properties: {
            type: { type: 'keyword' },
            appKey: { type: 'keyword' },
            appSecret: { type: 'keyword' }
          }
        },

        user: {
          properties: {
            type: { type: 'keyword' },
            places: { type: 'keyword' }
          }
        },

        search: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            title: { type: 'text' },
            description: { type: 'text' },
            created: { type: 'date', format: 'date_time' },
            creator: { type: 'keyword' },
            active: { type: 'boolean' },
            saved: { type: 'boolean' },
            'query.type': { type: 'keyword' },
            'query.value': { type: 'keyword' }
          }
        },

        place: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            name: { type: 'text' },
            country: { type: 'text' },
            countryCode: { type: 'keyword' },
            parentId: { type: 'keyword' }
          }
        },

        trend: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            'trends.name': { type: 'keyword' },
            'trends.tweets': { type: 'integer' }
          }
        },

        twuser: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            screenName: { type: 'keyword' },
            created: { type: 'date', format: 'date_time' },
            updated: { type: 'date', format: 'date_time' }
          }
        },

        tweet: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            search: { type: 'keyword' },
            retweetCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            created: { type: 'date', format: 'date_time' },
            client: { type: 'keyword' },
            hashtags: { type: 'keyword' },
            mentions: { type: 'keyword' },
            geo: { type: 'geo_shape' },
            videos: { type: 'keyword' },
            images: { type: 'keyword' },
            animatedGifs: { type: 'keyword' },
            emojis: { type: 'keyword' },

            country: { type: 'keyword' },
            countryCode: { type: 'keyword' },
            boundingBox: { type: 'geo_shape' },

            'urls.short': { type: 'keyword' },
            'urls.long': { type: 'keyword' },
            'urls.hostname': { type: 'keyword' },
            'user.screenName': { type: 'keyword' },
            'quote.user.screenName': { type: 'keyword' },
            'retweet.user.screenName': { type: 'keyword' }
          }
        }
      };
    }
  }]);
  return Database;
}();
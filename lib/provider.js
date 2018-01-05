var ProviderEngine = require("web3-provider-engine");
var SubscriptionSubprovider = require('web3-provider-engine/subproviders/subscriptions.js');

var BlockchainDouble = require('./blockchain_double.js');

var RequestFunnel = require('./subproviders/requestfunnel.js');
var DelayedBlockFilter = require("./subproviders/delayedblockfilter.js");
var GethDefaults = require("./subproviders/gethdefaults.js");
var GethApiDouble = require('./subproviders/geth_api_double.js');

var RuntimeError = require("./utils/runtimeerror");
var EventEmitter = require('events').EventEmitter;

function Provider(options) {
  var self = this;
  EventEmitter.call(this);

  if (options == null) {
    options = {};
  }

  if (options.logger == null) {
    options.logger = {
      log: function() {}
    };
  }

  this.options = options;
  this.engine = new ProviderEngine();

  var gethApiDouble = new GethApiDouble(options);
  this.subscriptionSubprovider = new SubscriptionSubprovider();

  this.engine.manager = gethApiDouble;
  this.engine.addProvider(new RequestFunnel());
  //this.engine.addProvider(new ReactiveBlockTracker());
  //this.engine.addProvider(new DelayedBlockFilter());
  this.engine.addProvider(this.subscriptionSubprovider);
  this.engine.addProvider(new GethDefaults());
  this.engine.addProvider(gethApiDouble);

  this.engine.setMaxListeners(100);
  this.engine.start();

  this.manager = gethApiDouble;
};

Provider.prototype = Object.create(EventEmitter.prototype);
Provider.prototype.constructor = Provider;

Provider.prototype.send = function(payload, callback) {
  var self = this;

  var externalize = function(payload) {
    var clone = {};
    var keys = Object.keys(payload);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      clone[key] = payload[key];
    }
    clone.external = true;
    return clone;
  };

  if (Array.isArray(payload)) {
    for (var i = 0; i < payload.length; i++) {
      payload[i] = externalize(payload[i]);
    }
  } else {
    payload = externalize(payload);
  }

  var intermediary = function(err, result) {
    if (err) {
      // If we find a runtime error, mimic the result that would be sent back from
      // normal Ethereum clients that don't return runtime errors (e.g., geth, parity).
      if (err instanceof RuntimeError && (payload.method == "eth_sendTransaction" || payload.method == "eth_sendRawTransaction")) {
        result.result = err.hashes[0];
      }
    } else if (self.options.verbose) {
      self.options.logger.log(" <   " + JSON.stringify(result, null, 2).split("\n").join("\n <   "));
    }
    callback(err, result);
  };

  if (self.options.verbose) {
    self.options.logger.log("   > " + JSON.stringify(payload, null, 2).split("\n").join("\n   > "));
  }

  this.engine.sendAsync(payload, intermediary);
};

Provider.prototype.close = function(callback) {
  // This is a little gross reaching, but...
  this.manager.state.blockchain.close(callback);
};

Provider.prototype.on = function(event, callback) {
  if (event === 'data') {
    this.subscriptionSubprovider.on(event, callback);
  } else {
    EventEmitter.prototype.on.apply(this, Array.prototype.slice.call(arguments));
  }
}

Provider.prototype.addListener = Provider.prototype.on;

Provider.prototype.once = function(event, callback) {
  if (event === 'data') {
    this.subscriptionSubprovider.once(event, callback);
  } else {
    EventEmitter.prototype.once.apply(this, Array.prototype.slice.call(arguments));
  }
}

Provider.prototype.removeListener = function(event, callback) {
  if (event === 'data') {
    this.subscriptionSubprovider.removeListener(event, callback);
  } else {
    EventEmitter.prototype.removeListener.apply(this, Array.prototype.slice.call(arguments));
  }
}

Provider.prototype.removeAllListeners = function(event) {
  if (event === 'data') {
    this.subscriptionSubprovider.removeAllListeners(event);
  } else {
    EventEmitter.prototype.removeAllListeners.apply(this, Array.prototype.slice.call(arguments));
  }
}

Provider.prototype.prependListener = function(event, callback) {
  if (event === 'data') {
    this.subscriptionSubprovider.prependListener(event, callback);
  } else {
    EventEmitter.prototype.prependListener.apply(this, Array.prototype.slice.call(arguments));
  }
}

Provider.prototype.prependOnceListener = function(event, callback) {
  if (event === 'data') {
    this.subscriptionSubprovider.prependOnceListener(event, callback);
  } else {
    EventEmitter.prototype.prependOnceListener.apply(this, Array.prototype.slice.call(arguments));
  }
}

Provider.prototype.listeners = function(event) {
  if (event === 'data') {
    this.subscriptionSubprovider.listeners(event);
  } else {
    EventEmitter.prototype.listeners.apply(this, Array.prototype.slice.call(arguments));
  }
}


module.exports = Provider;

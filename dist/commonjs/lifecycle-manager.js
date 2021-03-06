'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _aureliaDependencyInjection = require('aurelia-dependency-injection');

var _aureliaTemplating = require('aurelia-templating');

var _instanceDispatcher = require('./instance-dispatcher');

var _fluxDispatcher = require('./flux-dispatcher');

var _metadata = require('./metadata');

var _symbols = require('./symbols');

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _aureliaRouter = require('aurelia-router');

var LifecycleManager = (function () {
    function LifecycleManager() {
        _classCallCheck(this, LifecycleManager);
    }

    LifecycleManager.interceptInstanceDeactivators = function interceptInstanceDeactivators(instance) {
        if (instance[_symbols.Symbols.deactivators] === true) {
            return;
        }

        LifecycleManager.interceptInstanceDeactivate(instance);
        LifecycleManager.interceptInstanceDetached(instance);

        instance[_symbols.Symbols.deactivators] = true;
    };

    LifecycleManager.interceptInstanceDeactivate = function interceptInstanceDeactivate(instance) {

        function _unregister() {
            if (_fluxDispatcher.FluxDispatcher.instance.strategy !== _aureliaRouter.activationStrategy.invokeLifecycle) {
                _fluxDispatcher.FluxDispatcher.instance.unregisterInstanceDispatcher(instance[_symbols.Symbols.instanceDispatcher]);
            }
        }

        if (instance.deactivate !== undefined) {
            var deactivateImpl = instance.deactivate;
            instance.deactivate = function () {
                _unregister();

                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                }

                deactivateImpl.apply(instance, args);
            };
        } else {
            instance.deactivate = function () {
                _unregister();
            };
        }
    };

    LifecycleManager.interceptInstanceDetached = function interceptInstanceDetached(instance) {
        if (instance.detached !== undefined) {
            var deactivateImpl = instance.detached;
            instance.detached = function () {
                _fluxDispatcher.FluxDispatcher.instance.unregisterInstanceDispatcher(instance[_symbols.Symbols.instanceDispatcher]);

                for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                    args[_key2] = arguments[_key2];
                }

                deactivateImpl.apply(instance, args);
            };
        } else {
            instance.detached = function () {
                _fluxDispatcher.FluxDispatcher.instance.unregisterInstanceDispatcher(instance[_symbols.Symbols.instanceDispatcher]);
            };
        }
    };

    LifecycleManager.interceptHtmlBehaviorResource = function interceptHtmlBehaviorResource() {
        if (_aureliaTemplating.HtmlBehaviorResource === undefined || typeof _aureliaTemplating.HtmlBehaviorResource.prototype.initialize !== 'function') {
            throw new Error('Unsupported version of HtmlBehaviorResource');
        }

        var initializeImpl = _aureliaTemplating.HtmlBehaviorResource.prototype.initialize;

        _aureliaTemplating.HtmlBehaviorResource.prototype.initialize = function () {
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
            }

            var target = args[1];
            if (target && target.prototype && target.prototype[_symbols.Symbols.metadata] && target.prototype[_symbols.Symbols.metadata].handlers && target.prototype[_symbols.Symbols.metadata].handlers.size) {
                if (target.prototype.detached === undefined) {
                    target.prototype.detached = function () {};
                }
            }
            return initializeImpl.apply(this, args);
        };
    };

    LifecycleManager.interceptClassActivator = function interceptClassActivator() {

        if (_aureliaDependencyInjection.Container.instance === undefined || _aureliaDependencyInjection.Container.instance._createConstructionInfo === undefined) {
            throw new Error('Unsupported version of Container');
        }

        var constrInfoImpl = _aureliaDependencyInjection.Container.instance.__proto__._createConstructionInfo;

        _aureliaDependencyInjection.Container.instance.__proto__._createConstructionInfo = function () {
            var ci = constrInfoImpl.apply(_aureliaDependencyInjection.Container.instance, arguments);
            var invokeImpl = ci.activator.invoke;

            ci.activator.invoke = function () {
                for (var _len4 = arguments.length, invokeArgs = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                    invokeArgs[_key4] = arguments[_key4];
                }

                var args = invokeArgs[2],
                    instance;

                if (Array.isArray(args) === false) {
                    throw new Error('Unsupported version of Container');
                }

                var dispatcher = args.find(function (item) {
                    return item instanceof _instanceDispatcher.Dispatcher;
                });

                if (dispatcher) {
                    var instancePromise = _bluebird2['default'].defer();
                    args[args.indexOf(dispatcher)] = new _instanceDispatcher.DispatcherProxy(instancePromise.promise);
                    invokeArgs[2] = args;
                    instance = invokeImpl.apply(ci.activator, invokeArgs);
                    instance[_symbols.Symbols.instanceDispatcher] = new _instanceDispatcher.Dispatcher(instance);
                    instancePromise.resolve(instance);
                } else {
                    instance = invokeImpl.apply(ci.activator, invokeArgs);
                }

                if (_metadata.Metadata.exists(Object.getPrototypeOf(instance))) {
                    if (instance[_symbols.Symbols.instanceDispatcher] === undefined) {
                        instance[_symbols.Symbols.instanceDispatcher] = new _instanceDispatcher.Dispatcher(instance);
                    }
                    instance[_symbols.Symbols.instanceDispatcher].registerMetadata();
                }

                if (instance[_symbols.Symbols.instanceDispatcher] !== undefined) {
                    LifecycleManager.interceptInstanceDeactivators(instance);
                }

                return instance;
            };

            return ci;
        };
    };

    return LifecycleManager;
})();

exports.LifecycleManager = LifecycleManager;
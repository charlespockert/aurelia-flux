import {Container} from 'aurelia-dependency-injection';
import {HtmlBehaviorResource} from 'aurelia-templating';
import {Dispatcher, DispatcherProxy} from './instance-dispatcher';
import {FluxDispatcher} from './flux-dispatcher';
import {Metadata} from './metadata';
import {Symbols} from './symbols';
import Promise from 'bluebird';
import {activationStrategy} from 'aurelia-router';

export class LifecycleManager {

    static interceptInstanceDeactivators(instance) {
        if(instance[Symbols.deactivators] === true) {
          return;
        }

        LifecycleManager.interceptInstanceDeactivate(instance);
        LifecycleManager.interceptInstanceDetached(instance);

        instance[Symbols.deactivators] = true;
    }

    static interceptInstanceDeactivate(instance) {

      function _unregister() {
        if(FluxDispatcher.instance.strategy !== activationStrategy.invokeLifecycle) {
          FluxDispatcher.instance.unregisterInstanceDispatcher(instance[Symbols.instanceDispatcher]);
        }
      }

      if(instance.deactivate !== undefined) {
          var deactivateImpl = instance.deactivate;
          instance.deactivate = function(...args) {
              _unregister();              
              deactivateImpl.apply(instance, args);
          };
      } else {
          instance.deactivate = function() {
              _unregister();
          };
      }
    }

    static interceptInstanceDetached(instance) {
      if(instance.detached !== undefined) {
          var deactivateImpl = instance.detached;
          instance.detached = function(...args) {
              FluxDispatcher.instance.unregisterInstanceDispatcher(instance[Symbols.instanceDispatcher]);
              deactivateImpl.apply(instance, args);
          };
      } else {
          instance.detached = function() {
              FluxDispatcher.instance.unregisterInstanceDispatcher(instance[Symbols.instanceDispatcher]);
          };
      }
    }

    static interceptHtmlBehaviorResource() {
      if(HtmlBehaviorResource === undefined || typeof HtmlBehaviorResource.prototype.initialize !== 'function') {
        throw new Error('Unsupported version of HtmlBehaviorResource');
      }

      var initializeImpl = HtmlBehaviorResource.prototype.initialize;

      HtmlBehaviorResource.prototype.initialize = function(...args) {
        let target = args[1];        
        if(    target
            && target.prototype
            && target.prototype[Symbols.metadata]
            && target.prototype[Symbols.metadata].handlers
            && target.prototype[Symbols.metadata].handlers.size) {
          if(target.prototype.detached === undefined) {
            target.prototype.detached = function() {};
          }
        }
        return initializeImpl.apply(this, args);
      };
    }

    static interceptClassActivator() {

        if(Container.instance === undefined || Container.instance._createConstructionInfo === undefined) {
            throw new Error('Unsupported version of Container');
        }

        var constrInfoImpl = Container.instance._createConstructionInfo;

        // Intercept construction data creation
        Container.instance._createConstructionInfo = function () {
          var ci = constrInfoImpl.apply(Container.instance, arguments);
          var invokeImpl = ci.activator.invoke;

          // Intercept activation function
          ci.activator.invoke = function(...invokeArgs) {

            // Keys is 2nd arg
            var args = invokeArgs[2],
              instance;                

            if(Array.isArray(args) === false) {
                throw new Error('Unsupported version of Container');
            }
            
            var dispatcher = args.find((item) => { return item instanceof Dispatcher; });
            
            if(dispatcher) {
                var instancePromise = Promise.defer();
                args[args.indexOf(dispatcher)] = new DispatcherProxy(instancePromise.promise);
                invokeArgs[2] = args;
                instance = invokeImpl.apply(ci.activator, invokeArgs);                
                instance[Symbols.instanceDispatcher] = new Dispatcher(instance);
                instancePromise.resolve(instance);
            } else {
                instance = invokeImpl.apply(ci.activator, invokeArgs);
            }
            
            if(Metadata.exists(Object.getPrototypeOf(instance))) {
                if(instance[Symbols.instanceDispatcher] === undefined) {
                    instance[Symbols.instanceDispatcher] = new Dispatcher(instance);
                }                
                instance[Symbols.instanceDispatcher].registerMetadata();
            }

            if(instance[Symbols.instanceDispatcher] !== undefined) {
                LifecycleManager.interceptInstanceDeactivators(instance);
            }

            return instance;
          };

          return ci;
        };
    }
}

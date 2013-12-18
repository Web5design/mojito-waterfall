/*jslint anon:true, nomen:true*/
/*global YUI*/

YUI.add('mojito-waterfall-dispatcher', function (Y, NAME) {
    'use strict';

    Y.namespace('mojito.Waterfall').Dispatcher = Y.mix({

        init: function (resourceStore, rpcTunnel, waterfall) {
            this.waterfall = waterfall;
            return Y.mojito.Dispatcher.init.apply(this, arguments);
        },

        _createActionContext: function (command, adapter) {
            var ac,
                name = command.instance.base || command.instance.type,
                controllerName = Y.mojito.controllers[command.instance.controller],
                controller = Y.mojito.util.heir(controllerName);


            // HookSystem::StartBlock
            Y.mojito.hooks.hook('dispatchCreateAction', adapter.hook, 'start', command);
            // HookSystem::EndBlock

            // Note that creation of an ActionContext current causes
            // immediate invocation of the dispatch() call.
            try {
                this.waterfall.start('/' + name + '/Create Action Context', {profileType: 'mojito'});
                ac = new Y.mojito.Waterfall.ActionContext({
                    command: command,
                    controller: controller,
                    dispatcher: this,         // NOTE passing dispatcher.
                    adapter: adapter,
                    store: this.store
                }, this.waterfall, name);
                this.waterfall.end('/' + name + '/Create Action Context');

                // Calling controller after action context creation.
                this.waterfall.start('/' + name + '/Controller', {profileType: 'mojito'});
                controller[ac.action](ac);
            } catch (e) {
                Y.log('Error from dispatch on instance \'' +
                    (command.instance.id || '@' + command.instance.type) +
                    '\':', 'error', NAME);
                Y.log(e.message, 'error', NAME);
                Y.log(e.stack, 'error', NAME);
                adapter.error(e);
            }
            // HookSystem::StartBlock
            Y.mojito.hooks.hook('dispatchCreateAction', adapter.hook, 'end', command);
            // HookSystem::EndBlock
        },

        dispatch: function (command, adapter) {

            var my = this,
                store = this.store,
                name = command.instance.base || command.instance.type,
                done = adapter.done;

            my.waterfall.start('/' + name, {profileType: 'mojit'});

            adapter.done = function () {
                my.waterfall.end('/' + name + '/Render');
                my.waterfall.end('/' + name);
                done.apply(this, arguments);
            }.bind(adapter);

            // HookSystem::StartBlock
            Y.mojito.hooks.hook('dispatch', adapter.hook, 'start', command);
            // HookSystem::EndBlock
            try {
                store.validateContext(command.context);
            } catch (err) {
                adapter.error(err);
                return;
            }

            if (command.rpc) {
                // forcing to dispatch command through RPC tunnel
                this.rpc(command, adapter);
                return;
            }

            my.waterfall.start('/' + name + '/Expand Instance', {profileType: 'mojito'});
            store.expandInstance(command.instance, command.context,
                function (err, instance) {

                    my.waterfall.end('/' + name + '/Expand Instance');

                    // HookSystem::StartBlock
                    Y.mojito.hooks.hook('dispatch', adapter.hook, 'end', command);
                    // HookSystem::EndBlock

                    if (err || !instance || !instance.controller) {

                        adapter.error(new Error('Cannot expand instance [' + (command.instance.base || '@' +
                            command.instance.type) + '], or instance.controller is undefined'));
                        return;
                    }

                    // We replace the given instance with the expanded instance.
                    command.instance = instance;

                    if (!Y.mojito.controllers[instance.controller]) {
                        // the controller was not found, we should halt
                        adapter.error(new Error('Invalid controller name [' +
                            command.instance.controller + '] for mojit [' +
                            command.instance.type + '].'));
                    } else {
                        // dispatching AC
                        my._createActionContext(command, adapter);
                    }
                });
        }

    }, Y.mojito.Dispatcher);

}, '0.1.0', {requires: [
    'mojito-util',
    'mojito-hooks',
    'mojito-dispatcher',
    'mojito-waterfall-action-context'
]});
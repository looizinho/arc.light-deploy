Package["core-runtime"].queue("null", ["meteor-base", "mobile-experience", "mongo", "blaze-html-templates", "jquery", "reactive-var", "tracker", "standard-minifier-css", "standard-minifier-js", "es5-shim", "ecmascript", "typescript", "shell-server", "kadira:flow-router", "meteor", "webapp", "ddp", "hot-code-push", "launch-screen", "blaze", "templating", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ddp-client", "ddp-server", "autoupdate", "reload", "htmljs", "templating-runtime", "templating-compiler", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports for global scope */

MongoInternals = Package.mongo.MongoInternals;
Mongo = Package.mongo.Mongo;
ReactiveVar = Package['reactive-var'].ReactiveVar;
Tracker = Package.tracker.Tracker;
Deps = Package.tracker.Deps;
ECMAScript = Package.ecmascript.ECMAScript;
FlowRouter = Package['kadira:flow-router'].FlowRouter;
Meteor = Package.meteor.Meteor;
global = Package.meteor.global;
meteorEnv = Package.meteor.meteorEnv;
EmitterPromise = Package.meteor.EmitterPromise;
WebApp = Package.webapp.WebApp;
WebAppInternals = Package.webapp.WebAppInternals;
main = Package.webapp.main;
DDP = Package['ddp-client'].DDP;
DDPServer = Package['ddp-server'].DDPServer;
LaunchScreen = Package['launch-screen'].LaunchScreen;
Blaze = Package.blaze.Blaze;
UI = Package.blaze.UI;
Handlebars = Package.blaze.Handlebars;
meteorInstall = Package.modules.meteorInstall;
Promise = Package.promise.Promise;
Autoupdate = Package.autoupdate.Autoupdate;
HTML = Package.htmljs.HTML;

var require = meteorInstall({"imports":{"server":{"collections.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/server/collections.js                                                           //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
ColorPresets = new Mongo.Collection('presets');
ServerLogs = new Mongo.Collection('serverlogs');
Configs = new Mongo.Collection('configs');
/////////////////////////////////////////////////////////////////////////////////////////////

},"methods.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/server/methods.js                                                               //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("./collections");
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Meteor.methods({
      async getInstance() {
        return await 'mph';
      },
      async getConfig() {
        return await Configs.findOneAsync();
      },
      async login(pass) {
        const token = await Configs.findOneAsync();
        return token.userPassword == pass ? true : false;
      },
      setColor(_mode, _color) {
        let color = getColorByName(_color);
        let dateNow = new Date();
        Meteor.call('getConfig', (err, res) => {
          Configs.updateAsync(res._id, {
            $set: {
              mode: _mode,
              actualColorId: _color,
              'kph.actualColorRgb': color.kph,
              'mph.actualColorRgb': color.mph,
              'dev.actualColorRgb': color.dev,
              updatedAt: dateNow,
              timestamp: dateNow.valueOf()
            }
          });
        });
      },
      addColor(_name, _hex, _rgb) {
        let color = {
          b: _rgb.b,
          r: _rgb.r,
          g: _rgb.g
        };
        sendArtnet(color);

        // artnet.set(0, 1, loopGen(UNI_1_FIXTURES, color));
        // artnet.set(1, 1, loopGen(UNI_2_FIXTURES, color));

        // let dateTime = new Date()
        // ColorPresets.insertAsync({
        //   name: _name,
        //   createdAt: dateTime,
        //   timestamp: dateTime.valueOf(),
        //   color: {
        //     hex: _hex,
        //     r: _rgb.r,
        //     g: _rgb.g,
        //     b: _rgb.b
        //   }
        // })
      },
      async getColors() {
        return await ColorPresets.findOneAsync();
      },
      async checkConfig() {
        return await Configs.countDocuments();
      },
      async changePassword(_master, _new) {
        let config = await Configs.findOneAsync();
        let dateNow = new Date();
        if (_master === config.masterPassword) {
          Configs.updateAsync(config._id, {
            $set: {
              userPassword: _new,
              mode: config.mode,
              actualColorId: config.actualColorId,
              kph: config.kph,
              mph: config.mph,
              dev: config.dev,
              updatedAt: dateNow,
              timestamp: dateNow.valueOf()
            }
          });
          return true;
        } else {
          return false;
        }
      }
    });
    function getColorByName(color) {
      switch (color) {
        case 'ambar':
          return {
            name: 'Âmbar',
            mph: {
              "r": 255,
              "g": 156,
              "b": 62
            },
            dev: {
              "r": 255,
              "g": 156,
              "b": 62
            },
            kph: {
              "r": 206,
              "g": 156,
              "b": 62
            }
          };
        case 'preto':
          return {
            name: 'Desligado',
            mph: {
              "r": 0,
              "g": 0,
              "b": 0
            },
            dev: {
              "r": 0,
              "g": 0,
              "b": 0
            },
            kph: {
              "r": 0,
              "g": 0,
              "b": 0
            }
          };
        case 'branco':
          return {
            name: 'Branco',
            mph: {
              "r": 255,
              "g": 255,
              "b": 255
            },
            dev: {
              "r": 255,
              "g": 255,
              "b": 255
            },
            kph: {
              "r": 255,
              "g": 255,
              "b": 255
            }
          };
        case 'roxo':
          return {
            name: 'Roxo',
            mph: {
              "r": 128,
              "g": 0,
              "b": 255
            },
            kph: {
              "r": 128,
              "g": 0,
              "b": 255
            },
            dev: {
              "r": 128,
              "g": 0,
              "b": 255
            }
          };
        case 'azul-marinho':
          return {
            name: 'Azul-Marinho',
            mph: {
              "r": 0,
              "g": 0,
              "b": 128
            },
            kph: {
              "r": 0,
              "g": 0,
              "b": 128
            },
            dev: {
              "r": 0,
              "g": 0,
              "b": 128
            }
          };
        case 'verde':
          return {
            name: 'Verde',
            mph: {
              "r": 0,
              "g": 255,
              "b": 0
            },
            kph: {
              "r": 0,
              "g": 255,
              "b": 0
            },
            dev: {
              "r": 0,
              "g": 255,
              "b": 0
            }
          };
        case 'amarelo':
          return {
            name: 'Amarelo',
            mph: {
              "r": 255,
              "g": 255,
              "b": 0
            },
            kph: {
              "r": 206,
              "g": 255,
              "b": 0
            },
            dev: {
              "r": 255,
              "g": 255,
              "b": 0
            }
          };
        case 'vermelho':
          return {
            name: 'Vermelho',
            mph: {
              "r": 255,
              "g": 0,
              "b": 0
            },
            kph: {
              "r": 255,
              "g": 0,
              "b": 0
            },
            dev: {
              "r": 255,
              "g": 0,
              "b": 0
            }
          };
        case 'dourado':
          return {
            name: 'Dourado',
            mph: {
              "r": 218,
              "g": 165,
              "b": 32
            },
            kph: {
              "r": 218,
              "g": 165,
              "b": 32
            },
            dev: {
              "r": 218,
              "g": 165,
              "b": 32
            }
          };
        case 'rosa':
          return {
            name: 'Rosa',
            mph: {
              "r": 255,
              "g": 0,
              "b": 255
            },
            kph: {
              "r": 255,
              "g": 0,
              "b": 255
            },
            dev: {
              "r": 255,
              "g": 0,
              "b": 255
            }
          };
        case 'azul':
          return {
            name: 'Azul',
            mph: {
              "r": 0,
              "g": 0,
              "b": 255
            },
            kph: {
              "r": 0,
              "g": 0,
              "b": 255
            },
            dev: {
              "r": 0,
              "g": 0,
              "b": 255
            }
          };
        case 'laranja':
          return {
            name: 'Laranja',
            mph: {
              "r": 255,
              "g": 165,
              "b": 0
            },
            kph: {
              "r": 206,
              "g": 165,
              "b": 0
            },
            dev: {
              "r": 255,
              "g": 165,
              "b": 0
            }
          };
        default:
          return {
            name: 'Padrão',
            mph: {
              "r": 255,
              "g": 156,
              "b": 62
            },
            kph: {
              "r": 206,
              "g": 156,
              "b": 62
            },
            dev: {
              "r": 206,
              "g": 156,
              "b": 62
            }
          };
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"main.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// server/main.js                                                                          //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    module.link("../imports/server/collections");
    module.link("../imports/server/methods");
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    ////////// IMPORTANTE! //////////

    var INSTANCE = 'mph';

    ////////////////////////////////

    var HOST;
    if (INSTANCE == 'dev') {
      HOST = '127.0.0.1';
    } else if (INSTANCE == 'mph') {
      HOST = '10.0.0.100';
    } else if (INSTANCE == 'kph') {
      HOST = '192.168.0.30';
    }
    var artnet = require('artnet')({
      host: HOST,
      port: 6454,
      refresh: 4000,
      sendAll: true
    });
    const cron = require('node-cron');
    var h = 6;
    var m = 0;
    var s = 0;
    cron.schedule("".concat(s, " ").concat(m, " ").concat(h, " * * *"), () => {
      sendArtnet({
        r: 0,
        g: 0,
        b: 0
      });
    });
    cron.schedule("0 18 * * *", () => {
      Meteor.defer(async () => {
        await Meteor.call('getConfig', (err, cfg) => {
          sendArtnet(cfg[INSTANCE].actualColorRgb);
        });
      });
    });

    // artnet.set(0, 1, loopGen(UNI_1_FIXTURES, color));
    // artnet.set(1, 1, loopGen(UNI_2_FIXTURES, color));
    // artnet.set(0, 1, loopGen(UNI_1_FIXTURES, [0, 128, 96]));
    // artnet.set(1, 1, loopGen(UNI_2_FIXTURES, [0, 128, 96]));

    Meteor.startup(() => {
      // Meteor.defer(async () => {
      //   await Meteor.call('getInstance', (err, instance) => {
      //     INSTANCE = instance
      //   })
      // })

      Meteor.defer(async () => {
        await Meteor.call('getConfig', (err, cfg) => {
          sendArtnet(cfg[INSTANCE].actualColorRgb);
        });
      });
      Meteor.call('checkConfig', (err, res) => {
        if (res < 1) {
          let dateNow = new Date();
          Configs.insertAsync({
            power: true,
            mode: 'default',
            userPassword: 'jk@mph',
            masterPassword: 'eliteled@promarc',
            actualColorId: 'ambar',
            kph: {
              actualColorRgb: {
                "b": 62,
                "g": 156,
                "r": 206
              },
              defaultColorName: 'Kubitscheck Bege',
              defaultColorRgb: {
                "b": 62,
                "g": 156,
                "r": 206
              },
              interfaceIp: '192.168.0.30',
              interfaceName: 'Lumikit PRO x4i',
              universes: {
                universeZeroFixtures: 90,
                universeOneFixtures: 90,
                universeTwoFixtures: 90
              }
            },
            mph: {
              actualColorRgb: {
                "b": 62,
                "g": 156,
                "r": 255
              },
              defaultColorName: 'Manhattan Bege',
              defaultColorRgb: {
                "b": 62,
                "g": 156,
                "r": 255
              },
              interfaceIp: '10.0.0.100',
              interfaceName: 'looizinho ArtDMX Duo',
              universes: {
                universeZeroFixtures: 90,
                universeOneFixtures: 90,
                universeTwoFixtures: 90
              }
            },
            dev: {
              actualColorRgb: {
                "b": 62,
                "g": 156,
                "r": 206
              },
              defaultColorName: 'DEV Bege',
              defaultColorRgb: {
                "b": 62,
                "g": 156,
                "r": 206
              },
              interfaceIp: '127.0.0.1',
              interfaceName: 'Capture.se',
              universes: {
                universeZeroFixtures: 150,
                universeOneFixtures: 150,
                universeTwoFixtures: 0
              }
            },
            createdAt: dateNow,
            updatedAt: null,
            timestamp: dateNow.valueOf()
          });
          console.log('CONFIG CREATED!');
        } else {
          console.log('CONFIG EXISTS');
          Meteor.defer(async () => {
            await Meteor.call('getConfig', (err, res) => {});
          });
        }
      });
      var cursorConfigs = Configs.find();
      var cursorLogs = ServerLogs.find();
      cursorConfigs.observeChanges({
        changed(id, obj) {
          console.log(obj[INSTANCE].actualColorRgb);
          sendArtnet(obj[INSTANCE].actualColorRgb);
        }
      });
      cursorLogs.observeChanges({
        added(id, object) {}
      });
      ServerLogs.insertAsync({
        instance: INSTANCE,
        status: 'startup',
        timestamp: new Date().valueOf(),
        createdAt: new Date()
      });
    });
    function loopGen(fixturesQtt, rgb) {
      let opacity = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
      const arrayFixtures = [];
      for (let i = 0; i < fixturesQtt; i++) {
        arrayFixtures.push(rgb[0] * opacity, rgb[1] * opacity, rgb[2] * opacity);
      }
      return arrayFixtures;
    }
    function sendArtnet() {
      let color = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
        r: 255,
        g: 191,
        b: 0
      };
      artnet.set(0, 1, loopGen(90, [color.b, color.r, color.g]), function (err, res) {
        artnet.set(1, 1, loopGen(90, [color.b, color.r, color.g]), function (err, res) {
          // artnet.close();
        });
      });
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json",
    ".ts",
    ".mjs"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/server/main.js"
  ]
}});

//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9zZXJ2ZXIvY29sbGVjdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvc2VydmVyL21ldGhvZHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9tYWluLmpzIl0sIm5hbWVzIjpbIkNvbG9yUHJlc2V0cyIsIk1vbmdvIiwiQ29sbGVjdGlvbiIsIlNlcnZlckxvZ3MiLCJDb25maWdzIiwibW9kdWxlIiwibGluayIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiTWV0ZW9yIiwibWV0aG9kcyIsImdldEluc3RhbmNlIiwiZ2V0Q29uZmlnIiwiZmluZE9uZUFzeW5jIiwibG9naW4iLCJwYXNzIiwidG9rZW4iLCJ1c2VyUGFzc3dvcmQiLCJzZXRDb2xvciIsIl9tb2RlIiwiX2NvbG9yIiwiY29sb3IiLCJnZXRDb2xvckJ5TmFtZSIsImRhdGVOb3ciLCJEYXRlIiwiY2FsbCIsImVyciIsInJlcyIsInVwZGF0ZUFzeW5jIiwiX2lkIiwiJHNldCIsIm1vZGUiLCJhY3R1YWxDb2xvcklkIiwia3BoIiwibXBoIiwiZGV2IiwidXBkYXRlZEF0IiwidGltZXN0YW1wIiwidmFsdWVPZiIsImFkZENvbG9yIiwiX25hbWUiLCJfaGV4IiwiX3JnYiIsImIiLCJyIiwiZyIsInNlbmRBcnRuZXQiLCJnZXRDb2xvcnMiLCJjaGVja0NvbmZpZyIsImNvdW50RG9jdW1lbnRzIiwiY2hhbmdlUGFzc3dvcmQiLCJfbWFzdGVyIiwiX25ldyIsImNvbmZpZyIsIm1hc3RlclBhc3N3b3JkIiwibmFtZSIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsInYiLCJJTlNUQU5DRSIsIkhPU1QiLCJhcnRuZXQiLCJyZXF1aXJlIiwiaG9zdCIsInBvcnQiLCJyZWZyZXNoIiwic2VuZEFsbCIsImNyb24iLCJoIiwibSIsInMiLCJzY2hlZHVsZSIsImNvbmNhdCIsImRlZmVyIiwiY2ZnIiwiYWN0dWFsQ29sb3JSZ2IiLCJzdGFydHVwIiwiaW5zZXJ0QXN5bmMiLCJwb3dlciIsImRlZmF1bHRDb2xvck5hbWUiLCJkZWZhdWx0Q29sb3JSZ2IiLCJpbnRlcmZhY2VJcCIsImludGVyZmFjZU5hbWUiLCJ1bml2ZXJzZXMiLCJ1bml2ZXJzZVplcm9GaXh0dXJlcyIsInVuaXZlcnNlT25lRml4dHVyZXMiLCJ1bml2ZXJzZVR3b0ZpeHR1cmVzIiwiY3JlYXRlZEF0IiwiY29uc29sZSIsImxvZyIsImN1cnNvckNvbmZpZ3MiLCJmaW5kIiwiY3Vyc29yTG9ncyIsIm9ic2VydmVDaGFuZ2VzIiwiY2hhbmdlZCIsImlkIiwib2JqIiwiYWRkZWQiLCJvYmplY3QiLCJpbnN0YW5jZSIsInN0YXR1cyIsImxvb3BHZW4iLCJmaXh0dXJlc1F0dCIsInJnYiIsIm9wYWNpdHkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJhcnJheUZpeHR1cmVzIiwiaSIsInB1c2giLCJzZXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLFlBQVksR0FBRyxJQUFJQyxLQUFLLENBQUNDLFVBQVUsQ0FBQyxTQUFTLENBQUM7QUFDOUNDLFVBQVUsR0FBRyxJQUFJRixLQUFLLENBQUNDLFVBQVUsQ0FBQyxZQUFZLENBQUM7QUFDL0NFLE9BQU8sR0FBRyxJQUFJSCxLQUFLLENBQUNDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQzs7Ozs7Ozs7Ozs7Ozs7SUNGekNHLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBRXpGQyxNQUFNLENBQUNDLE9BQU8sQ0FBQztNQUNiLE1BQU1DLFdBQVdBLENBQUEsRUFBRztRQUNsQixPQUFPLE1BQU0sS0FBSztNQUNwQixDQUFDO01BRUQsTUFBTUMsU0FBU0EsQ0FBQSxFQUFHO1FBQ2hCLE9BQU8sTUFB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LmpzIiwic291cmNlc0NvbnRlbnQiOlsiQ29sb3JQcmVzZXRzID0gbmV3IE1vbmdvLkNvbGxlY3Rpb24oJ3ByZXNldHMnKVxuU2VydmVyTG9ncyA9IG5ldyBNb25nby5Db2xsZWN0aW9uKCdzZXJ2ZXJsb2dzJylcbkNvbmZpZ3MgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignY29uZmlncycpIiwiaW1wb3J0ICcuL2NvbGxlY3Rpb25zJ1xuXG5NZXRlb3IubWV0aG9kcyh7XG4gIGFzeW5jIGdldEluc3RhbmNlKCkge1xuICAgIHJldHVybiBhd2FpdCAnbXBoJ1xuICB9LFxuXG4gIGFzeW5jIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4gYXdhaXQgQ29uZmlncy5maW5kT25lQXN5bmMoKVxuICB9LFxuXG4gIGFzeW5jIGxvZ2luKHBhc3MpIHtcbiAgICBjb25zdCB0b2tlbiA9IGF3YWl0IENvbmZpZ3MuZmluZE9uZUFzeW5jKCk7XG4gICAgcmV0dXJuIHRva2VuLnVzZXJQYXNzd29yZCA9PSBwYXNzID8gdHJ1ZSA6IGZhbHNlXG4gIH0sXG5cbiAgc2V0Q29sb3IoX21vZGUsIF9jb2xvcikge1xuICAgIGxldCBjb2xvciA9IGdldENvbG9yQnlOYW1lKF9jb2xvcilcbiAgICBsZXQgZGF0ZU5vdyA9IG5ldyBEYXRlKClcblxuICAgIE1ldGVvci5jYWxsKCdnZXRDb25maWcnLCAoZXJyLCByZXMpID0+IHtcbiAgICAgIENvbmZpZ3MudXBkYXRlQXN5bmMocmVzLl9pZCwge1xuICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgbW9kZTogX21vZGUsXG4gICAgICAgICAgYWN0dWFsQ29sb3JJZDogX2NvbG9yLFxuICAgICAgICAgICdrcGguYWN0dWFsQ29sb3JSZ2InOiBjb2xvci5rcGgsXG4gICAgICAgICAgJ21waC5hY3R1YWxDb2xvclJnYic6IGNvbG9yLm1waCxcbiAgICAgICAgICAnZGV2LmFjdHVhbENvbG9yUmdiJzogY29sb3IuZGV2LFxuICAgICAgICAgIHVwZGF0ZWRBdDogZGF0ZU5vdyxcbiAgICAgICAgICB0aW1lc3RhbXA6IGRhdGVOb3cudmFsdWVPZigpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgfSxcblxuICBhZGRDb2xvcihfbmFtZSwgX2hleCwgX3JnYikge1xuICAgIGxldCBjb2xvciA9IHsgYjogX3JnYi5iLCByOiBfcmdiLnIsIGc6IF9yZ2IuZyB9XG4gICAgc2VuZEFydG5ldChjb2xvcilcblxuICAgIC8vIGFydG5ldC5zZXQoMCwgMSwgbG9vcEdlbihVTklfMV9GSVhUVVJFUywgY29sb3IpKTtcbiAgICAvLyBhcnRuZXQuc2V0KDEsIDEsIGxvb3BHZW4oVU5JXzJfRklYVFVSRVMsIGNvbG9yKSk7XG5cbiAgICAvLyBsZXQgZGF0ZVRpbWUgPSBuZXcgRGF0ZSgpXG4gICAgLy8gQ29sb3JQcmVzZXRzLmluc2VydEFzeW5jKHtcbiAgICAvLyAgIG5hbWU6IF9uYW1lLFxuICAgIC8vICAgY3JlYXRlZEF0OiBkYXRlVGltZSxcbiAgICAvLyAgIHRpbWVzdGFtcDogZGF0ZVRpbWUudmFsdWVPZigpLFxuICAgIC8vICAgY29sb3I6IHtcbiAgICAvLyAgICAgaGV4OiBfaGV4LFxuICAgIC8vICAgICByOiBfcmdiLnIsXG4gICAgLy8gICAgIGc6IF9yZ2IuZyxcbiAgICAvLyAgICAgYjogX3JnYi5iXG4gICAgLy8gICB9XG4gICAgLy8gfSlcbiAgfSxcblxuICBhc3luYyBnZXRDb2xvcnMoKSB7XG4gICAgcmV0dXJuIGF3YWl0IENvbG9yUHJlc2V0cy5maW5kT25lQXN5bmMoKVxuICB9LFxuXG4gIGFzeW5jIGNoZWNrQ29uZmlnKCkge1xuICAgIHJldHVybiBhd2FpdCBDb25maWdzLmNvdW50RG9jdW1lbnRzKClcbiAgfSxcblxuICBhc3luYyBjaGFuZ2VQYXNzd29yZChfbWFzdGVyLCBfbmV3KSB7XG4gICAgbGV0IGNvbmZpZyA9IGF3YWl0IENvbmZpZ3MuZmluZE9uZUFzeW5jKClcbiAgICBsZXQgZGF0ZU5vdyA9IG5ldyBEYXRlKClcbiAgICBpZiAoX21hc3RlciA9PT0gY29uZmlnLm1hc3RlclBhc3N3b3JkKSB7XG4gICAgICBDb25maWdzLnVwZGF0ZUFzeW5jKGNvbmZpZy5faWQsIHtcbiAgICAgICAgJHNldDoge1xuICAgICAgICAgIHVzZXJQYXNzd29yZDogX25ldyxcbiAgICAgICAgICBtb2RlOiBjb25maWcubW9kZSxcbiAgICAgICAgICBhY3R1YWxDb2xvcklkOiBjb25maWcuYWN0dWFsQ29sb3JJZCxcbiAgICAgICAgICBrcGg6IGNvbmZpZy5rcGgsXG4gICAgICAgICAgbXBoOiBjb25maWcubXBoLFxuICAgICAgICAgIGRldjogY29uZmlnLmRldixcbiAgICAgICAgICB1cGRhdGVkQXQ6IGRhdGVOb3csXG4gICAgICAgICAgdGltZXN0YW1wOiBkYXRlTm93LnZhbHVlT2YoKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG59KTtcblxuZnVuY3Rpb24gZ2V0Q29sb3JCeU5hbWUoY29sb3IpIHtcbiAgc3dpdGNoIChjb2xvcikge1xuICAgIGNhc2UgJ2FtYmFyJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICfDgm1iYXInLFxuICAgICAgICBtcGg6IHsgXCJyXCI6IDI1NSwgXCJnXCI6IDE1NiwgXCJiXCI6IDYyIH0sXG4gICAgICAgIGRldjogeyBcInJcIjogMjU1LCBcImdcIjogMTU2LCBcImJcIjogNjIgfSxcbiAgICAgICAga3BoOiB7IFwiclwiOiAyMDYsIFwiZ1wiOiAxNTYsIFwiYlwiOiA2MiB9XG4gICAgICB9XG4gICAgY2FzZSAncHJldG8nOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ0Rlc2xpZ2FkbycsXG4gICAgICAgIG1waDogeyBcInJcIjogMCwgXCJnXCI6IDAsIFwiYlwiOiAwIH0sXG4gICAgICAgIGRldjogeyBcInJcIjogMCwgXCJnXCI6IDAsIFwiYlwiOiAwIH0sXG4gICAgICAgIGtwaDogeyBcInJcIjogMCwgXCJnXCI6IDAsIFwiYlwiOiAwIH1cbiAgICAgIH1cbiAgICBjYXNlICdicmFuY28nOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ0JyYW5jbycsXG4gICAgICAgIG1waDogeyBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1IH0sXG4gICAgICAgIGRldjogeyBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1IH0sXG4gICAgICAgIGtwaDogeyBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1IH1cbiAgICAgIH1cbiAgICBjYXNlICdyb3hvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdSb3hvJyxcbiAgICAgICAgbXBoOiB7IFwiclwiOiAxMjgsIFwiZ1wiOiAwLCBcImJcIjogMjU1IH0sXG4gICAgICAgIGtwaDogeyBcInJcIjogMTI4LCBcImdcIjogMCwgXCJiXCI6IDI1NSB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDEyOCwgXCJnXCI6IDAsIFwiYlwiOiAyNTUgfVxuICAgICAgfVxuICAgIGNhc2UgJ2F6dWwtbWFyaW5obyc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiAnQXp1bC1NYXJpbmhvJyxcbiAgICAgICAgbXBoOiB7IFwiclwiOiAwLCBcImdcIjogMCwgXCJiXCI6IDEyOCB9LFxuICAgICAgICBrcGg6IHsgXCJyXCI6IDAsIFwiZ1wiOiAwLCBcImJcIjogMTI4IH0sXG4gICAgICAgIGRldjogeyBcInJcIjogMCwgXCJnXCI6IDAsIFwiYlwiOiAxMjggfVxuICAgICAgfVxuICAgIGNhc2UgJ3ZlcmRlJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdWZXJkZScsXG4gICAgICAgIG1waDogeyBcInJcIjogMCwgXCJnXCI6IDI1NSwgXCJiXCI6IDAgfSxcbiAgICAgICAga3BoOiB7IFwiclwiOiAwLCBcImdcIjogMjU1LCBcImJcIjogMCB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDAsIFwiZ1wiOiAyNTUsIFwiYlwiOiAwIH1cbiAgICAgIH1cbiAgICBjYXNlICdhbWFyZWxvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdBbWFyZWxvJyxcbiAgICAgICAgbXBoOiB7IFwiclwiOiAyNTUsIFwiZ1wiOiAyNTUsIFwiYlwiOiAwIH0sXG4gICAgICAgIGtwaDogeyBcInJcIjogMjA2LCBcImdcIjogMjU1LCBcImJcIjogMCB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDI1NSwgXCJnXCI6IDI1NSwgXCJiXCI6IDAgfVxuICAgICAgfVxuICAgIGNhc2UgJ3Zlcm1lbGhvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdWZXJtZWxobycsXG4gICAgICAgIG1waDogeyBcInJcIjogMjU1LCBcImdcIjogMCwgXCJiXCI6IDAgfSxcbiAgICAgICAga3BoOiB7IFwiclwiOiAyNTUsIFwiZ1wiOiAwLCBcImJcIjogMCB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDI1NSwgXCJnXCI6IDAsIFwiYlwiOiAwIH1cbiAgICAgIH1cbiAgICBjYXNlICdkb3VyYWRvJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdEb3VyYWRvJyxcbiAgICAgICAgbXBoOiB7IFwiclwiOiAyMTgsIFwiZ1wiOiAxNjUsIFwiYlwiOiAzMiB9LFxuICAgICAgICBrcGg6IHsgXCJyXCI6IDIxOCwgXCJnXCI6IDE2NSwgXCJiXCI6IDMyIH0sXG4gICAgICAgIGRldjogeyBcInJcIjogMjE4LCBcImdcIjogMTY1LCBcImJcIjogMzIgfVxuICAgICAgfVxuICAgIGNhc2UgJ3Jvc2EnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ1Jvc2EnLFxuICAgICAgICBtcGg6IHsgXCJyXCI6IDI1NSwgXCJnXCI6IDAsIFwiYlwiOiAyNTUgfSxcbiAgICAgICAga3BoOiB7IFwiclwiOiAyNTUsIFwiZ1wiOiAwLCBcImJcIjogMjU1IH0sXG4gICAgICAgIGRldjogeyBcInJcIjogMjU1LCBcImdcIjogMCwgXCJiXCI6IDI1NSB9XG4gICAgICB9XG4gICAgY2FzZSAnYXp1bCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiAnQXp1bCcsXG4gICAgICAgIG1waDogeyBcInJcIjogMCwgXCJnXCI6IDAsIFwiYlwiOiAyNTUgfSxcbiAgICAgICAga3BoOiB7IFwiclwiOiAwLCBcImdcIjogMCwgXCJiXCI6IDI1NSB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDAsIFwiZ1wiOiAwLCBcImJcIjogMjU1IH1cbiAgICAgIH1cbiAgICBjYXNlICdsYXJhbmphJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdMYXJhbmphJyxcbiAgICAgICAgbXBoOiB7IFwiclwiOiAyNTUsIFwiZ1wiOiAxNjUsIFwiYlwiOiAwIH0sXG4gICAgICAgIGtwaDogeyBcInJcIjogMjA2LCBcImdcIjogMTY1LCBcImJcIjogMCB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDI1NSwgXCJnXCI6IDE2NSwgXCJiXCI6IDAgfVxuICAgICAgfVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiAnUGFkcsOjbycsXG4gICAgICAgIG1waDogeyBcInJcIjogMjU1LCBcImdcIjogMTU2LCBcImJcIjogNjIgfSxcbiAgICAgICAga3BoOiB7IFwiclwiOiAyMDYsIFwiZ1wiOiAxNTYsIFwiYlwiOiA2MiB9LFxuICAgICAgICBkZXY6IHsgXCJyXCI6IDIwNiwgXCJnXCI6IDE1NiwgXCJiXCI6IDYyIH1cbiAgICAgIH1cbiAgfVxufSIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0ICcuLi9pbXBvcnRzL3NlcnZlci9jb2xsZWN0aW9ucydcbmltcG9ydCAnLi4vaW1wb3J0cy9zZXJ2ZXIvbWV0aG9kcydcblxuLy8vLy8vLy8vLyBJTVBPUlRBTlRFISAvLy8vLy8vLy8vXG5cbnZhciBJTlNUQU5DRSA9ICdtcGgnO1xuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG52YXIgSE9TVDtcblxuaWYgKElOU1RBTkNFID09ICdkZXYnKSB7XG4gIEhPU1QgPSAnMTI3LjAuMC4xJ1xufSBlbHNlIGlmIChJTlNUQU5DRSA9PSAnbXBoJykge1xuICBIT1NUID0gJzEwLjAuMC4xMDAnXG59IGVsc2UgaWYgKElOU1RBTkNFID09ICdrcGgnKSB7XG4gIEhPU1QgPSAnMTkyLjE2OC4wLjMwJ1xufVxuXG52YXIgYXJ0bmV0ID0gcmVxdWlyZSgnYXJ0bmV0Jykoe1xuICBob3N0OiBIT1NULFxuICBwb3J0OiA2NDU0LFxuICByZWZyZXNoOiA0MDAwLFxuICBzZW5kQWxsOiB0cnVlXG59KTtcbmNvbnN0IGNyb24gPSByZXF1aXJlKCdub2RlLWNyb24nKTtcblxudmFyIGggPSA2XG52YXIgbSA9IDBcbnZhciBzID0gMFxuXG5jcm9uLnNjaGVkdWxlKGAke3N9ICR7bX0gJHtofSAqICogKmAsICgpID0+IHtcbiAgc2VuZEFydG5ldCh7IHI6IDAsIGc6IDAsIGI6IDAgfSlcbn0pO1xuXG5jcm9uLnNjaGVkdWxlKGAwIDE4ICogKiAqYCwgKCkgPT4ge1xuICBNZXRlb3IuZGVmZXIoYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IE1ldGVvci5jYWxsKCdnZXRDb25maWcnLCAoZXJyLCBjZmcpID0+IHtcbiAgICAgIHNlbmRBcnRuZXQoY2ZnW0lOU1RBTkNFXS5hY3R1YWxDb2xvclJnYik7XG4gICAgfSlcbiAgfSlcbn0pO1xuXG4vLyBhcnRuZXQuc2V0KDAsIDEsIGxvb3BHZW4oVU5JXzFfRklYVFVSRVMsIGNvbG9yKSk7XG4vLyBhcnRuZXQuc2V0KDEsIDEsIGxvb3BHZW4oVU5JXzJfRklYVFVSRVMsIGNvbG9yKSk7XG4vLyBhcnRuZXQuc2V0KDAsIDEsIGxvb3BHZW4oVU5JXzFfRklYVFVSRVMsIFswLCAxMjgsIDk2XSkpO1xuLy8gYXJ0bmV0LnNldCgxLCAxLCBsb29wR2VuKFVOSV8yX0ZJWFRVUkVTLCBbMCwgMTI4LCA5Nl0pKTtcblxuTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuXG4gIC8vIE1ldGVvci5kZWZlcihhc3luYyAoKSA9PiB7XG4gIC8vICAgYXdhaXQgTWV0ZW9yLmNhbGwoJ2dldEluc3RhbmNlJywgKGVyciwgaW5zdGFuY2UpID0+IHtcbiAgLy8gICAgIElOU1RBTkNFID0gaW5zdGFuY2VcbiAgLy8gICB9KVxuICAvLyB9KVxuXG4gIE1ldGVvci5kZWZlcihhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgTWV0ZW9yLmNhbGwoJ2dldENvbmZpZycsIChlcnIsIGNmZykgPT4ge1xuICAgICAgc2VuZEFydG5ldChjZmdbSU5TVEFOQ0VdLmFjdHVhbENvbG9yUmdiKTtcbiAgICB9KVxuICB9KVxuXG4gIE1ldGVvci5jYWxsKCdjaGVja0NvbmZpZycsIChlcnIsIHJlcykgPT4ge1xuICAgIGlmIChyZXMgPCAxKSB7XG4gICAgICBsZXQgZGF0ZU5vdyA9IG5ldyBEYXRlKClcbiAgICAgIENvbmZpZ3MuaW5zZXJ0QXN5bmMoe1xuICAgICAgICBwb3dlcjogdHJ1ZSxcbiAgICAgICAgbW9kZTogJ2RlZmF1bHQnLFxuICAgICAgICB1c2VyUGFzc3dvcmQ6ICdqa0BtcGgnLFxuICAgICAgICBtYXN0ZXJQYXNzd29yZDogJ2VsaXRlbGVkQHByb21hcmMnLFxuICAgICAgICBhY3R1YWxDb2xvcklkOiAnYW1iYXInLFxuICAgICAgICBrcGg6IHtcbiAgICAgICAgICBhY3R1YWxDb2xvclJnYjogeyBcImJcIjogNjIsIFwiZ1wiOiAxNTYsIFwiclwiOiAyMDYgfSxcbiAgICAgICAgICBkZWZhdWx0Q29sb3JOYW1lOiAnS3ViaXRzY2hlY2sgQmVnZScsXG4gICAgICAgICAgZGVmYXVsdENvbG9yUmdiOiB7IFwiYlwiOiA2MiwgXCJnXCI6IDE1NiwgXCJyXCI6IDIwNiB9LFxuICAgICAgICAgIGludGVyZmFjZUlwOiAnMTkyLjE2OC4wLjMwJyxcbiAgICAgICAgICBpbnRlcmZhY2VOYW1lOiAnTHVtaWtpdCBQUk8geDRpJyxcbiAgICAgICAgICB1bml2ZXJzZXM6IHtcbiAgICAgICAgICAgIHVuaXZlcnNlWmVyb0ZpeHR1cmVzOiA5MCxcbiAgICAgICAgICAgIHVuaXZlcnNlT25lRml4dHVyZXM6IDkwLFxuICAgICAgICAgICAgdW5pdmVyc2VUd29GaXh0dXJlczogOTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgbXBoOiB7XG4gICAgICAgICAgYWN0dWFsQ29sb3JSZ2I6IHsgXCJiXCI6IDYyLCBcImdcIjogMTU2LCBcInJcIjogMjU1IH0sXG4gICAgICAgICAgZGVmYXVsdENvbG9yTmFtZTogJ01hbmhhdHRhbiBCZWdlJyxcbiAgICAgICAgICBkZWZhdWx0Q29sb3JSZ2I6IHsgXCJiXCI6IDYyLCBcImdcIjogMTU2LCBcInJcIjogMjU1IH0sXG4gICAgICAgICAgaW50ZXJmYWNlSXA6ICcxMC4wLjAuMTAwJyxcbiAgICAgICAgICBpbnRlcmZhY2VOYW1lOiAnbG9vaXppbmhvIEFydERNWCBEdW8nLFxuICAgICAgICAgIHVuaXZlcnNlczoge1xuICAgICAgICAgICAgdW5pdmVyc2VaZXJvRml4dHVyZXM6IDkwLFxuICAgICAgICAgICAgdW5pdmVyc2VPbmVGaXh0dXJlczogOTAsXG4gICAgICAgICAgICB1bml2ZXJzZVR3b0ZpeHR1cmVzOiA5MCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBkZXY6IHtcbiAgICAgICAgICBhY3R1YWxDb2xvclJnYjogeyBcImJcIjogNjIsIFwiZ1wiOiAxNTYsIFwiclwiOiAyMDYgfSxcbiAgICAgICAgICBkZWZhdWx0Q29sb3JOYW1lOiAnREVWIEJlZ2UnLFxuICAgICAgICAgIGRlZmF1bHRDb2xvclJnYjogeyBcImJcIjogNjIsIFwiZ1wiOiAxNTYsIFwiclwiOiAyMDYgfSxcbiAgICAgICAgICBpbnRlcmZhY2VJcDogJzEyNy4wLjAuMScsXG4gICAgICAgICAgaW50ZXJmYWNlTmFtZTogJ0NhcHR1cmUuc2UnLFxuICAgICAgICAgIHVuaXZlcnNlczoge1xuICAgICAgICAgICAgdW5pdmVyc2VaZXJvRml4dHVyZXM6IDE1MCxcbiAgICAgICAgICAgIHVuaXZlcnNlT25lRml4dHVyZXM6IDE1MCxcbiAgICAgICAgICAgIHVuaXZlcnNlVHdvRml4dHVyZXM6IDAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlZEF0OiBkYXRlTm93LFxuICAgICAgICB1cGRhdGVkQXQ6IG51bGwsXG4gICAgICAgIHRpbWVzdGFtcDogZGF0ZU5vdy52YWx1ZU9mKClcbiAgICAgIH0pXG4gICAgICBjb25zb2xlLmxvZygnQ09ORklHIENSRUFURUQhJylcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ0NPTkZJRyBFWElTVFMnKVxuICAgICAgTWV0ZW9yLmRlZmVyKGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgTWV0ZW9yLmNhbGwoJ2dldENvbmZpZycsIChlcnIsIHJlcykgPT4ge1xuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9XG4gIH0pO1xuXG4gIHZhciBjdXJzb3JDb25maWdzID0gQ29uZmlncy5maW5kKCk7XG4gIHZhciBjdXJzb3JMb2dzID0gU2VydmVyTG9ncy5maW5kKCk7XG5cbiAgY3Vyc29yQ29uZmlncy5vYnNlcnZlQ2hhbmdlcyh7XG4gICAgY2hhbmdlZChpZCwgb2JqKSB7XG4gICAgICBjb25zb2xlLmxvZyhvYmpbSU5TVEFOQ0VdLmFjdHVhbENvbG9yUmdiKVxuICAgICAgc2VuZEFydG5ldChvYmpbSU5TVEFOQ0VdLmFjdHVhbENvbG9yUmdiKTtcbiAgICB9XG4gIH0pO1xuXG4gIGN1cnNvckxvZ3Mub2JzZXJ2ZUNoYW5nZXMoe1xuICAgIGFkZGVkKGlkLCBvYmplY3QpIHtcbiAgICB9XG4gIH0pO1xuXG4gIFNlcnZlckxvZ3MuaW5zZXJ0QXN5bmMoe1xuICAgIGluc3RhbmNlOiBJTlNUQU5DRSxcbiAgICBzdGF0dXM6ICdzdGFydHVwJyxcbiAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudmFsdWVPZigpLFxuICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKVxuICB9KVxufSk7XG5cbmZ1bmN0aW9uIGxvb3BHZW4oZml4dHVyZXNRdHQsIHJnYiwgb3BhY2l0eSA9IDEpIHtcbiAgY29uc3QgYXJyYXlGaXh0dXJlcyA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGZpeHR1cmVzUXR0OyBpKyspIHtcbiAgICBhcnJheUZpeHR1cmVzLnB1c2gocmdiWzBdICogb3BhY2l0eSwgcmdiWzFdICogb3BhY2l0eSwgcmdiWzJdICogb3BhY2l0eSk7XG4gIH1cbiAgcmV0dXJuIGFycmF5Rml4dHVyZXM7XG59XG5cbmZ1bmN0aW9uIHNlbmRBcnRuZXQoY29sb3IgPSB7IHI6IDI1NSwgZzogMTkxLCBiOiAwIH0pIHtcbiAgYXJ0bmV0LnNldCgwLCAxLCBsb29wR2VuKDkwLCBbY29sb3IuYiwgY29sb3IuciwgY29sb3IuZ10pLCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICBhcnRuZXQuc2V0KDEsIDEsIGxvb3BHZW4oOTAsIFtjb2xvci5iLCBjb2xvci5yLCBjb2xvci5nXSksIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgLy8gYXJ0bmV0LmNsb3NlKCk7XG4gICAgfSk7XG4gIH0pO1xufSJdfQ==

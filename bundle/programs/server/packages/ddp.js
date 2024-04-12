Package["core-runtime"].queue("ddp", ["meteor", "ddp-client", "ddp-server"], function () {/* Imports */
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;



/* Exports */
return {
  export: function () { return {
      DDP: DDP,
      DDPServer: DDPServer
    };}
}});

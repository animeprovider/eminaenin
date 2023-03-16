const prefixes =
    `
    const document = { documentElement: {} };
    const jQuery = function () { return { off: function () { return { on: function(e) { return { on: function() { return { on: function() { return { on: function() { return { on: function() { return {  }; } }; } }; } }; } }; } }; }, ready: function (e) {} } };
    jQuery.fn = { dropdown: {}, extend: {} };
    const window = { fn: { extend: {} } };
    const navigator = {};
    const setTimeout = function(){};
    const clearTimeout = function(){};
    const setInterval = function(){};
    const clearInterval = function(){};
    `
module.exports=prefixes
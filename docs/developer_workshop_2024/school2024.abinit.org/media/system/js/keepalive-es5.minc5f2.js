!function(){"use strict";if(!window.Joomla)throw new Error("Joomla API was not properly initialised");var o=Joomla.getOptions("system.keepalive"),t=o&&o.interval?parseInt(o.interval,10):45e3,e=o&&o.uri?o.uri.replace(/&amp;/g,"&"):"";if(""===e){var a=Joomla.getOptions("system.paths");e=(a?a.root+"/index.php":window.location.pathname)+"?option=com_ajax&format=json"}setInterval((function(){return fetch(e,{method:"POST"})}),t)}();
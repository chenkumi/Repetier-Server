routeModule = angular.module('RouteModule', []);
routeModule.config(function ($routeProvider, $locationProvider) {
    $routeProvider
        .when('/', {templateUrl: 'views/home.php', controller: HomeController})
        .when('/about', {templateUrl: 'views/about.php', controller: AboutController})
        .when('/printer/:slug', {templateUrl: 'views/printer.php', controller: PrinterController})
        .when('/printerConfig/:slug', {templateUrl: 'views/printerConfig.php', controller: PrinterConfigController})
        .when('/scriptConfig/:slug', {templateUrl: 'views/scripts.php', controller: ScriptConfigController})
        .when('/userconfig',{templateUrl:'views/user.php',controller: UserConfigController})
        .when('/login',{templateUrl:'views/login.php',controller: UserLoginController})
        .otherwise({redirectTo: '/'});
    // $locationProvider.html5Mode(true);
});
routeModule.factory('WS', ['$q', '$rootScope','User','$location', function ($q, $rootScope,User,$location) {
    // We return this object to anything injecting our service
    var Service = {};
    // Keep all pending requests here until they get responses
    var callbacks = {};
    // Create a unique callback ID to map requests to responses
    var currentCallbackId = 0;
    // Create our websocket object with the address to the websocket
    var ws;
    Service.connected = false;
    var deflist = [];
    var printerSlug = '';

    var startConnection = function () {
        ws = new WebSocket("ws://" + window.location.host + "/socket/");
        ws.onopen = function () {
            Service.connected = true;
            $.each(deflist, function (idx, val) {
                val.resolve(ws);
            });
            deflist = [];
            $rootScope.$apply();
            $('#connectionLost').modal('hide');
            $rootScope.$broadcast("connected");
        }
        ws.onerror = function (message) {
            console.log("websocket error");
            console.log(message);
            //$('#connectionLost').modal('show');
        }
        ws.onclose = function (message) {
            Service.connected = false;
            $('#connectionLost').modal('show');
            setTimeout(function () {
                startConnection();
            }, 2000);
            $rootScope.$broadcast("disconnected");
        };
        ws.onmessage = function (message) {
            listener(JSON.parse(message.data));
        };
    };
    $rootScope.forceLogin = function() {
        if($location.path()!='/login')
            $rootScope.pathAfterLogin = $location.path();
        console.log("login required for page "+$rootScope.pathAfterLogin);
        $location.path('/login');

    }
    $rootScope.$on('loginRequired',function() {
        $rootScope.forceLogin();
    });
    startConnection();

    function sendRequest(request) {
        var defer = $q.defer();
        var callbackId = getCallbackId();
        callbacks[callbackId] = {
            time: new Date(),
            cb: defer
        };
        request.callback_id = callbackId;
        if (!Service.connected) {
            d = $q.defer();
            deflist.push(d);
            d.promise.then(function () {
                request["session"] = User.getSession();
                ws.send(JSON.stringify(request));
            }, function () {
                console.log("failed");
            });
        } else
            ws.send(JSON.stringify(request));
        return defer.promise;
    }

    function listener(data) {
        var messageObj = data;
        if(typeof(messageObj.session) != 'undefined')
            User.setSession(messageObj.session);
        // If an object exists with callback_id in our callbacks object, resolve it
        if (messageObj.callback_id < 0) { // event
            angular.forEach(messageObj.data,function(evt) {
                $rootScope.$broadcast(evt.event, evt);
            });
        } else if (callbacks.hasOwnProperty(messageObj.callback_id)) {
            if(typeof(messageObj.data.permissionDenied)!='undefined') {
                delete callbacks[messageObj.callbackID];
                $rootScope.forceLogin();
                return;
            }
            $rootScope.$apply(callbacks[messageObj.callback_id].cb.resolve(messageObj.data));
            delete callbacks[messageObj.callbackID];
        }
    }

    // This creates a new callback ID for a request
    function getCallbackId() {
        currentCallbackId += 1;
        if (currentCallbackId > 10000) {
            currentCallbackId = 0;
        }
        return currentCallbackId;
    }

    Service.send = function (command, data) {
        return sendRequest({action: command, data: data, printer: printerSlug});
    }
    Service.selectPrinter = function (slug) {
        printerSlug = slug;
    }
    return Service;
}])
var app = angular.module('server', ['ngSanitize', 'RouteModule', 'Gauge', 'FoundationHelper', 'Filter', 'Widgets','Slider','Preview']);
function init() {
    app.run(function ($location, $rootScope) {
        $rootScope.$on('$viewContentLoaded', function () {
            console.log('init foundation');
            $(document).foundation();
        });
        $location.path('/')
    });
}

function equalheight() {
    $('.equalheight').each(function (index) {
        var maxHeight = 0;
        $(this).children().each(function (index) {
            if ($(this).height() > maxHeight)
                maxHeight = $(this).height();
        });
        $(this).children().height(maxHeight);
    });
}
$(window).bind("load", init);
$(window).bind("load", equalheight);
$(window).bind("resize", equalheight);
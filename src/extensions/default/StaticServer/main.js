/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, browser: true */
/*global $, define, brackets */

define(function (require, exports, module) {
    "use strict";

    var AppInit              = brackets.getModule("utils/AppInit"),
        ExtensionUtils       = brackets.getModule("utils/ExtensionUtils"),
        FileUtils            = brackets.getModule("file/FileUtils"),
        LiveDevServerManager = brackets.getModule("LiveDevelopment/LiveDevServerManager"),
        NodeConnection       = brackets.getModule("utils/NodeConnection"),
        ProjectManager       = brackets.getModule("project/ProjectManager");

    /**
     * @private
     * @type{NodeConnection}
     * Connection to node
     */
    var _nodeConnection = null;

    var _baseUrl = "";
    
    /**
     * @private
     * @type{?jQuery.Promise}
     * Holds the most recent promise from startServer(). Used in
     * StaticServerProvider.readyToServe
     */
    var _serverStartupPromise = null;

    /**
     * @private
     * Calls connect.startServer to start a new server at the project root
     *
     * @return promise which is resolved:
     *      - immediately if there is no node connection
     *      - when staticServer.startServer() callback returns
     */
    function startServer() {
        var deferred = $.Deferred();

        if (_nodeConnection) {
            var projectPath = ProjectManager.getProjectRoot().fullPath;
            _nodeConnection.domains.staticServer.getServer(
                projectPath
            ).then(function (address) {
                // TODO: need to make protocol configurable?
                _baseUrl = "http://" + address.address + ":" + address.port + "/";
                deferred.resolve();
            });
        } else {
            deferred.reject();
        }

        return deferred.promise();
    }


    /**
     * @constructor
     */
    function StaticServerProvider() {}

    /**
     * Determines whether we can serve file type.
     * 
     * @param {String} url 
     * A url to file being served.
     *
     * @return {Boolean} 
     * true for yes, otherwise false.
     */
    StaticServerProvider.prototype.canServe = function (url) {

        if (!ProjectManager.isWithinProject(url)) {
            return false;
        }

        // url ending in / implies default file, which is usually
        // index.html, so LiveDevServerManager we can server it
        if (url.match(/\/$/)) {
            return true;
        }

        // FUTURE: do a MIME Type lookup on file extension
        return FileUtils.isStaticHtmlFileExt(url);
    };

    /**
     * Returns a base url for current project. 
     *
     * @return {String}
     * Base url for current project.
     */
    StaticServerProvider.prototype.getBaseUrl = function () {
        return _baseUrl;
    };

    /**
     * # LiveDevServerProvider.readyToServe()
     *
     * Used to check if the server has finished launching after opening
     * the project.
     *
     * @return {boolean + jQuery.Promise} Whether the server is ready
     *    (possibly as a promise that resolves/rejects when ready/failed)
     */
    StaticServerProvider.prototype.readyToServe = function () {
        return _serverStartupPromise || false;
    };
    
    
    // TODO: instead of opening a server for every project, should we
    // close old one so there's only 1 open?
    function _projectOpen(e) {
        _serverStartupPromise = startServer();
    }

    AppInit.appReady(function () {
        // Create a new node connection and register our "connect" domain
        _nodeConnection = new NodeConnection();
        _nodeConnection.connect(true).then(function () {
            _nodeConnection.loadDomains(
                [ExtensionUtils.getModulePath(module, "node/StaticServerDomain")],
                true
            ).then(
                startServer,
                function () { console.error(arguments); }
            );
        });

        // Register as a Live Development server provider
        var staticServerProvider = new StaticServerProvider();
        LiveDevServerManager.registerProvider(staticServerProvider, 5);
    });

    $(ProjectManager).on("projectOpen", _projectOpen);
});

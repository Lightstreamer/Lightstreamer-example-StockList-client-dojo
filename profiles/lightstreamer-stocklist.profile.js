var profile = {
	basePath: "../",
	releaseDir: "../dist",
	packages: [
		// this assumes these modules exist in parallel to src
		"dojo", "dijit", "dgrid", "xstyle", "put-selector", "lightstreamer-store", "Lightstreamer"
	],
	optimize: "closure",
	layerOptimize: "closure",
	layers: {
		"dojo/dojo": {
			include: [
				"dojo/domReady", "dojo/_base/declare", "dojox/charting/Chart", 	
				"dojox/charting/axis2d/Default", "dojox/charting/plot2d/Default",
				"dojox/charting/themes/Claro", "dojox/charting/StoreSeries",
	        	"dijit/layout/BorderContainer", "dijit/Dialog", 
				"dijit/form/ToggleButton", "dijit/registry", "dgrid", 
				"dgrid/editor", "dojo/_base/lang", "dojo/store/Memory", 
				"dojo/store/Observable", "dojo/parser", "dojo/domReady",
				"dojo/store/util/QueryResults", "dojo/store/util/SimpleQueryEngine",
				"dojox/collections/ArrayList", "dojox/collections/Dictionary",
			],
			boot: true,
			customBase: true
		},
		"lightstreamer-stocklist/index": {
			include: [
				"lightstreamer-store/LightstreamerStore", 
				"Lightstreamer/LightstreamerClient",
				"Lightstreamer/StatusWidget",
				"lightstreamer-store/LightstreamerStore",
				"../src/index.js"
			],
			exclude: [
				"dojo/dojo"
			]
		}
	},
	staticHasFeatures: {
		// The trace & log APIs are used for debugging the loader, so we don’t need them in the build
		'dojo-trace-api': 0,
		'dojo-log-api': 0,

		// This causes normally private loader data to be exposed for debugging, so we don’t need that either
		'dojo-publish-privates': 0,

		// We’re fully async, so get rid of the legacy loader
		'dojo-sync-loader': 0,

		// We aren’t loading tests in production
		'dojo-test-sniff': 0
	}
};

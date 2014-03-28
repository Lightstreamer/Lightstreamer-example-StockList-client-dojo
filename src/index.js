/*
Copyright 2013 Weswit s.r.l.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

require([
  "js/lsClient", "lightstreamer-store/LightstreamerStore", 
  "dojox/charting/Chart", "dojox/charting/axis2d/Default", 
  "dojox/charting/plot2d/Default", "dojox/charting/themes/Claro", 
  "dojox/charting/StoreSeries", "dijit/layout/BorderContainer",
  "dijit/Dialog", "dijit/form/ToggleButton", "dijit/registry", 
  "dgrid", "dgrid/editor", "dojo/_base/lang", "dojo/store/Memory", 
  "dojo/store/Observable", "dojo/parser", "dojo/domReady!"
], function(lsClient, LightstreamerStore,
  Chart, axis2dDefault, plot2dDefault, Claro, StoreSeries,
  BorderContainer, Dialog, ToggleButton, registry, Grid, editor,
  lang, Memory, Observable, parser){

  //  Formatters for various parts of the UI
  formatters = {
    //  CHART FORMATTERS
    time: function(value){
      var tmp = new Date(Number(value));
      return ("0" + tmp.getHours()).slice(-2) 
        + ":" 
        + ("0" + tmp.getMinutes()).slice(-2) 
        + ":" 
        + ("0" + tmp.getSeconds()).slice(-2);
    }
  };

  //  functions to cast from one type to another.  Used in the chart.
  converters = {
    time: function(time){
      //  convert the given time format (HH:MM:SS) to a real date object.
      var tmp = time.split(":"), now = new Date();
      var ret = new Date(
        now.getFullYear(), 
        now.getMonth(), 
        now.getDate(), 
        parseInt(tmp[0], 10), 
        parseInt(tmp[1], 10), 
        parseInt(tmp[2], 10), 
        0
      );
      return ret;
    }
  };

  handlers = {
      
    configureXAxis: function(startTime) {
      //configure the X
      lowTime = startTime;
      highTime = lowTime + LIMIT;
      
      chart.addAxis("x", dojo.mixin(dojo.clone(config.xAxis), titleInfo, { min: lowTime, max: highTime, from: lowTime, to: highTime}));
      
      //delete "obsolete" points
      for (var i in chartSeries) { 
        
        var remIfLowerThan = lowTime-1000;
        var toRem = chartSeries[i].store.query(function(obj){
          return obj.x < remIfLowerThan;
        });
        
        toRem.forEach(function(obj) {
          chartSeries[i].store.remove(obj.id);
        });
      }
    },
    
    toggle: function(value) {
      //  generic function designed to make the toggle
      var id = this.id;
      if(!value){
        //  we want to prevent something being turned off, so block it here.
        this._onChangeActive = false;
        this.set("checked", true);
        this._onChangeActive = true;
        return;
      }

      //  ok, we checked this one, so let's make sure the others are unchecked.
      dojo.forEach(config.plotButtons, function(b){
        if("button" + b == id) { 
          return; 
        }
        var button = dijit.byId("button" + b);
        if(button){
          button._onChangeActive = false;
          button.set("checked", false);
          button._onChangeActive = true;
        }
      });

      //  now that the UI is done, switch the chart plot and go.
      var plot = {type: "Default", lines: true, markers: true, tension: "X" };
      switch(this.id){
        case "buttonCurvedArea":{
          plot.areas = true;
          break;
        }
        case "buttonStraightLines":{
          delete plot.tension;
          break;
        }
        case "buttonLinesOnly": {
          plot.markers = false;
          break;
        }
      }

      // ugly trick follows. Any alternative?
      
      //remove chartSeries
      for (var i in chartSeries) { 
        chart.removeSeries(chartSeries[i].id);
      }
      //switch plot
      chart.removePlot("default");
      chart.addPlot("default", plot);
      //add back chart series
      for (var i in chartSeries) { 
        chart.addSeries(chartSeries[i].id, new dojox.charting.StoreSeries(chartSeries[i].store, {},   { x: "x", y: "y" }), fixedThemes[chartSeries[i].id-1]);
      }
      //repaint
      chart.render();
      
    }
  };

  //  BEGIN APPLICATION ------------------------------------------------------------

  var config = {
    itemsList: ["item1", "item2", "item3", "item4", "item5", "item6", "item7", "item8", "item9", "item11"],
    fieldsList: ["last_price", "time", "timestamp", "pct_change", "bid_quantity", "bid", "ask", "ask_quantity", "min", "max", "ref_price", "open_price", "stock_name", "item_status"],
    columns: [
                editor({ label: "Show", field: "show", sortable: true, autosave: true }, "checkbox"),
                { id: "legend", label: "Legend", field: "legend", renderCell: function (object, data, td, options){
                                                                                      var span = document.createElement("span");
                                                                                      span.style.setProperty("width", "12px", "important");
                                                                                      span.style.setProperty("height", "12px", "important");                                                                                    
                                                                                      span.style.setProperty("display", "inline-block", "important");
                                                                                      span.style.setProperty("background-color", data||"", "important");
                                                                                      return span;
                                                                                    },
                                                                                    sortable: true
                },
                { id: "name", label: "Name", field: "stock_name", sortable: true },
                { id: "last", label: "Last", field: "last_price", sortable: true },
                { id: "norm", label: "Norm", field: "ref_price", sortable: true },
                { id: "time", label: "Updated", field: "time", sortable: true },
                { id: "change", label: "Change", field: "pct_change", renderCell: function (object, data, td, options){
                                                                                      var div = document.createElement("span");
                                                                                      if (data<0) {
                                                                                        div.style.setProperty("color", "red", "important");
                                                                                        div.innerHTML = "";
                                                                                      } else {
                                                                                        div.style.setProperty("color", "green", "important");
                                                                                        div.innerHTML = "+";
                                                                                      }
                                                                                      div.innerHTML = div.innerHTML + data + "%";
                                                                                      return div;
                                                                                  }, 
                                                                                  sortable: true },
                { id: "bid_size", label: "Bid Size", field: "bid_quantity", sortable: true },
                { id: "bid", label: "Bid", field: "bid", sortable: true },
                { id: "ask", label: "Ask", field: "ask", sortable: true },
                { id: "ask_size", label: "Ask Size", field: "ask_quantity", sortable: true }
            ],
    xAxis: { 
      title: "Time", 
      fixLower: "major", 
      fixUpper: "minor", 
      natural: true, 
      labelFunc: formatters.time,  
      majorLabels: true, majorTicks: true, majorTick: {length:10}, majorTickStep:5000,
      minorLabels: false, minorTicks:true, minorTick:{length:6},  minorTickStep:1000
    },
    plotButtons: [ "CurvedLines", "StraightLines", "LinesOnly" ]
  };

  //  extra info for the chart
  var titleInfo = {
    titleFont: "Verdana",
    titleFontColor: "#636656",
    titleOrientation: "away",
    titleGap: 3
  };
  
//make a couple of adjustments on the chart Claro theme.
  var dc = dojox.charting, c = dc.themes.Claro, Theme = dc.Theme, g = Theme.generateGradient,
    st = c.seriesThemes, mt = c.markerThemes, 
    defaultFill = { type: "linear", space: "shape", x1: 0, y1:0, x2: 0, y2: 100 };

  //  remove the stroke around the chart itself.
  c.chart.stroke = null;

  //  add in another 10 colors, using the gradient creator.
  st.push(
    {fill: g(defaultFill, "#2120e0", "#2424ff")},
    {fill: g(defaultFill, "#943707", "#c7490a")},
    {fill: g(defaultFill, "#fbc694", "#c79d75")},
    {fill: g(defaultFill, "#e0bd20", "#ad9218")},
    {fill: g(defaultFill, "#947e15", "#c7aa1c")},
    {fill: g(defaultFill, "#205c6e", "#2b7b94")},
    {fill: g(defaultFill, "#6d6cc7", "#515094")},
    {fill: g(defaultFill, "#e06220", "#ad4c18")},
    {fill: g(defaultFill, "#c76430", "#a35327")},
    {fill: g(defaultFill, "#47422e", "#7a7250")}
  );
  mt.push(
    {fill: "#2120e0", stroke: {color:"#fff"}},
    {fill: "#943707", stroke: {color:"#fff"}},
    {fill: "#fbc694", stroke: {color:"#fff"}},
    {fill: "#e0bd20", stroke: {color:"#fff"}},
    {fill: "#947e15", stroke: {color:"#fff"}},
    {fill: "#205c6e", stroke: {color:"#fff"}},
    {fill: "#6d6cc7", stroke: {color:"#fff"}},
    {fill: "#e06220", stroke: {color:"#fff"}},
    {fill: "#c76430", stroke: {color:"#fff"}},
    {fill: "#47422e", stroke: {color:"#fff"}}
  );
  
  var markersStyles = [
                "m-3,0 c0,-4 6,-4 6,0 m-6,0 c0,4 6,4 6,0",
                "m-3,-3 l0,6 6,0 0,-6 z",
                "m0,-3 l3,3 -3,3 -3,-3 z",
                "m0,-3 l0,6 m-3,-3 l6,0",
                "m-3,-3 l6,6 m0,-6 l-6,6",
                "m-3,3 l3,-6 3,6 z",
                "m-3,-3 l3,6 3,-6 z"
                ];
  
  // If I don't create a fixed theme per each series, the chart will assign random colors to the various lines
  // even worse, each time a new series is added all the colors of already live series are reassigned
  var fixedThemes = [];
  var themeI = 0;
  var markerI = 0;
  for (var i=0; i<config.itemsList.length; i++, themeI++, markerI++) {
    themeI = themeI >= mt.length ? 0 : themeI;
    markerI = markerI >= markersStyles.length ? 0 : markerI;
    
    fixedThemes.push({
      fill: mt[themeI].fill,
      color: mt[themeI].fill,
      
      marker: markersStyles[markerI],
      markerStroke: mt[themeI].stroke,
      markerFill: mt[themeI].fill,
      markerOutline: mt[themeI].fill 
    });
    
  }
  
  // let dojo parse the html
  parser.parse();
 
//HERE starts the interesting stuff  
  
// initiate the LightstreamerStore
  var stockStore = new LightstreamerStore(lsClient, {
    items: config.itemsList, 
    fields: config.fieldsList,
    mode: "MERGE",
    dataAdapter: "QUOTE_ADAPTER",
    //requestedMaxFrequency: 0.5
  });
  
  

// create the grid
  var grid = new Grid({
      columns:  config.columns,
      region: 'center',
      height: 'auto',
      updateDelay: 0,
      });
 
  grid.styleColumn("last", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("norm", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("change", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("bid_size", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("bid", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("ask", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("ask_size", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  
  grid.styleColumn("time", "width: 7em; text-align: right; padding: 2px; border-width: 0px;");
  grid.styleColumn("legend", "width: 7em; text-align: center; border-width: 0px;");
  grid.styleColumn("name", "width: auto; text-align: left; padding-left: 2px; border-width: 0px;");
  grid.styleColumn(0, "width: 7em; text-align: left; border-width: 0px;");
    
  // bind the grid with the store
  grid.set("store",stockStore);
  registry.byId("grid").set("content", grid);
  
  //start sorting by stock_name
  grid.set("sort","stock_name"); 
  
  
// automatically set the show flag to true on the first three items showing up
  var INITIAL_CHARTS = 3;
  var showHelper = stockStore.query();
  var autoShowCount = 0;
  var showObserver = showHelper.observe(function(updatedObject, oldPosition, newPosition) {
    if (newPosition != -1) {
      if (autoShowCount < INITIAL_CHARTS && !updatedObject["show"]) {
        updatedObject["show"] = true;
        autoShowCount++;
        
        stockStore.put(updatedObject);
        
        if (autoShowCount >= INITIAL_CHARTS) {
          showObserver.cancel();
        }
            
      }
    }
  });
  
  
// initiate the chart
  var LIMIT = 30000;
  var lowTime = 0, highTime = 0;
  var chartSeries = {};
  var chartResults = stockStore.query({show: true});
  
  var chart = new dojox.charting.Chart("chartArea").
    setTheme(dojox.charting.themes.Claro).
    addAxis("y", {vertical: true, fixLower: "minor", fixUpper: "minor", includeZero: false, min: 95, max: 105 }).
    addPlot("default", {type: "Default", lines: true, markers: true, tension: "X" });
    //x axis will be set when the first chart needs to be shown.
  chart.render();
    
  //set up the chart resize
  var cp = dijit.byId("chartArea");
  dojo.connect(cp, "resize", function(){
    chart.resize();
  });
  
  chart.setTheme(dojox.charting.themes.Claro); 
  
  // fill the chart querying for itmes having the show flag set to true
  chartResults.observe(function(updatedObject, oldPosition, newPosition) {
    
    if (newPosition == -1) {
      //remove chart
      if (chartSeries[updatedObject["id"]]) {
        chart.removeSeries(updatedObject["id"]);
        delete(chartSeries[updatedObject["id"]]);
      }
      
    } else {
      
      //update chart
      
      var updateMs = converters.time(updatedObject["time"]).valueOf();
      while (updateMs > highTime) { 
        handlers.configureXAxis(chart.getSeriesOrder("default").length>0 ? lowTime+(LIMIT/2) : updateMs);
      }
      
      
      var updating = chartSeries[updatedObject["id"]];
      if (!updating) {
        //new chart
        
        updating = { id:updatedObject["id"], count: 0, store: Observable(new Memory({
            data: {
              identifier: "id",
              label: updatedObject["stock_name"],
              items: []
            }
          }))
        };

        chartSeries[updating.id] = updating;
        
        chart.addSeries(updatedObject["id"], new dojox.charting.StoreSeries(updating.store, {},   { x: "x", y: "y" }), fixedThemes[updating.id-1]);
        
        //show the used color in the grid
        updatedObject["legend"] = fixedThemes[updating.id-1].fill;
        stockStore.put(updatedObject);
      }
      
      var last = updating.store.get(updating.count);
      
      //normalize price
      var updatePrice = parseFloat(updatedObject["last_price"]);
      var normalizedPrice = !last ? 100 : updatePrice/last.oy*100;
     
      //BEWARE: this is a trick: since our demo feed sends timestamps rounded to the second, and
      //can send up to three updates for a single item with the same timestamp, we shift 
      //these updates to plot a better chart. In a real world application you would
      //receive timestamps rounded to the millisecond if needed.
      if (last && Math.floor(updateMs/1000) == Math.floor(last.x/1000)) {
        updateMs=last.x+300;
      }
      //trick ends here
      

      //add new point to the series store
      updating.store.put({ y: normalizedPrice, x: updateMs, oy: updatePrice, id: ++updating.count});
    
    }
    
  });
  
  var btnStraight = dijit.byId("buttonStraightLines");
  btnStraight.onChange = handlers.toggle;

  var btnCurved = dijit.byId("buttonCurvedLines");
  btnCurved.onChange = handlers.toggle;

  var btnLines = dijit.byId("buttonLinesOnly");
  btnLines.onChange = handlers.toggle;
  
});
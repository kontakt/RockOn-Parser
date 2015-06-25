// Rockon parser engine
// Connor Huffine
// ver 2.0 (6.24.2015)

//// CONFIG ////
var DEBUG = false;      // Spits out a lot of data that makes debugging helpful
                        // Slows things down a LOT.
var MAX_POINTS  = 500;  // Maximum number of points in the graph per data set
var MAX_TIME    = 500;  // After this many seconds, ignore recorded data

//// OBJECTS & GLOBALS ////
function dataSet (name) { /// Dataset object
  this.name = name;       // Object identifier
  this.max = {x : -Infinity, y : -Infinity};  // Maximum value
  this.min = {x : Infinity, y : Infinity};    // Minimum value
  this.raw = [];          // Raw data points
  this.sampled = [];      // Downsampled data points
}

var Series = [];  // Array of data to graph
var Scales = [];  // Approprate scales for the axes

//// FUNCTIONS ////
function radFileSelect(evt) {
  var start = performance.now();  // For timing the file process
  Radar = new dataSet('Radar');   // Create Radar dataset
  var rows = 0;                   // Number of rows processed
  var steps = 1;                  // Number of steps in this tenth-second
  var first = true;               // This is the first valid radar value
  var offset = 0;                 // The inital altitude of the rocket
  var files = evt.target.files;   // The file object to get data from
  Papa.parse(files[0], {          // Process the csv file
    dynamicTyping : true,         // Create numbers from detected values
    delimiter : "",               // Automatically determine the delimiter
    step: function(row, handle) {   /// Runs each row of processed data
      if (typeof (row.data[0][0]) == 'number') {    /// If valid, process
        var time = Math.ceil(row.data[0][0]*10);    // Determine time to nearest tenth of a second
        if (first) {                 /// Run only once
          offset = row.data[0][3];   // Use the initial height as base
        }
        if (Radar.raw[time]) {     /// If still in the same tenth-second
          Radar.raw[time].y += (row.data[0][3]-offset); // Add in the altitude
          steps++;                       // Note the number of combined values
        }
        else {    /// If in a new second
          if(Radar.raw[time-1]) {  /// If not the first value
            Radar.raw[time-1].y *= (0.3048/steps);  // Convert to meters and average
            if (Radar.raw[time-1].y > Radar.max.y)  /// Check if new max
              Radar.max = Radar.raw[time-1];        // If new max, copy
            if (Radar.raw[time-1].y < Radar.min.y)  /// Check if new min
              Radar.min = Radar.raw[time-1];        // If new min, copy
          }
          steps = 1;  // Reset steps to 1
          Radar.raw.push({x: time/10, y: (row.data[0][3]-offset)}); // Add a new point
        }
        first = false;  // No longer in the first value
      }
      rows++;   // Increment row counter
    },
    complete : function(results) {    /// Runs once the data has been processed
      Scales[0] = d3.scale.linear().domain(Radar.max.y).nice(); // Scale the y axis
      annotator.add(Radar.max.x, "RADAR Apogee");               // Denote the apogee
      annotator.update();                                       // Draw denotation
      Radar.sampled = largestTriangleThreeBuckets(Radar.raw, MAX_POINTS); // Downsample the radar data
      Series.push({                         /// Push to the graph
              name: 'RADAR Altitude (m)',   // Name
              data: Radar.sampled,          // Data to graph
              scale: Scales[0],             // Scale to graph by
              color: palette.color(),       // Color scheme
              renderer: 'line'              // Visual rendering style
      });
      lyAxis = new Rickshaw.Graph.Axis.Y.Scaled({   /// Push new axis to the graph
              graph: graph,                         // Graph to push to
              orientation: 'left',                  // Side of graph to push to
              element: document.getElementById("axis0"),  // Container to place inside
              width: 40,                            // Width to draw axis
              height: graph.height,                 // Height of the axis
              scale: Scales[0],                     // Scale to number by
              tickFormat: Rickshaw.Fixtures.Number.formatKMBT // How to label the axis ticks
      });
      updateGraph();  // Update the graph
      console.log(rows + " RADAR entries processed in " + (performance.now()-start).toFixed(2) + " ms");  // Report how long it took
    }
  });
  document.getElementById('list').innerHTML = files[0].name;  // Write the name of the last file parsed
}

function init() {   /// Add handlers and start up the graph
  document.getElementById('radFiles').addEventListener('change', radFileSelect, false); // Run the radar parser on file select
}

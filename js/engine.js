// Rockon parser engine
// Connor Huffine
// ver 2.0 (6.24.2015)

//// CONFIG ////
var DEBUG = false;      // Spits out a lot of data that makes debugging helpful
                        // Slows things down a LOT.
var MAX_POINTS  = 500;  // Maximum number of points in the graph per data set
var MAX_TIME    = 800;  // After this many seconds, ignore recorded data

//// OBJECTS & GLOBALS ////
function dataSet (name, format) { /// Dataset object
  this.name = name;       // Object identifier, displayed in index
  this.format = format;   // Display formatting
  this.max = {x : -Infinity, y : -Infinity};  // Maximum value
  this.min = {x : Infinity, y : Infinity};    // Minimum value
  this.raw = [];          // Raw data points
  this.sampled = [];      // Downsampled data points
  this.scale = d3.scale.linear().domain([0, 100]).nice(); // Scale for this value
  this.calcMaxMin = function(){
    var yarr = this.raw.map(function(o){return o.y;});
    this.max = this.raw[yarr.indexOf(Math.max.apply(Math, yarr))];
    this.min = this.raw[yarr.indexOf(Math.min.apply(Math, yarr))];
  };
  this.sample = function(){
    this.sampled = largestTriangleThreeBuckets(this.raw, MAX_POINTS);
  };
  this.calcScale = function(){
    this.scale = d3.scale.linear().domain([this.min.y, this.max.y]).nice();
  };
  this.finish = function(){
    this.calcMaxMin();
    this.sample();
    this.calcScale();
    Series.push({
            name: this.name,
            data: this.sampled,
            scale: this.scale,
            format: this.format,
            disabled: true,
            color: palette.color(),
            renderer: 'line'
    });
  };
}

var Series = [];  // Array of data to graph

//// FUNCTIONS ////
function radFileSelect(evt) {
  var start = performance.now();  // For timing the file process
  Radar = new dataSet('RADAR Altitude (m)', 'm');   // Create Radar dataset
  var rows = 0;                   // Number of rows processed
  var first = true;               // This is the first valid radar value
  var offset = 0;                 // The inital altitude of the rocket
  var files = evt.target.files;   // The file object to get data from
  Papa.parse(files[0], {          // Process the csv file
    dynamicTyping : true,         // Create numbers from detected values
    delimiter : " ",               // Automatically determine the delimiter
    step: function(row, handle) {   /// Runs each row of processed data
      for (var i = 0, len = row.data[0].length; i < len; i++) {
        if(row.data[0][i] == ""){
          row.data [0].splice(i, 1);
          i--;
          len--;
        }
      }
      if(row.data[0][0] != 151761000000)
        return;
      var time = row.data[0][1];    // Determine time to nearest tenth of a second
      if (time > MAX_TIME) return;
      if (first) {                 /// Run only once
        offset = row.data[0][9];   // Use the initial height as base
        first = false;  // No longer in the first value
      }
      Radar.raw.push({x: row.data[0][1], y: (row.data[0][9]-offset)}); // Add a new point
      rows++;   // Increment row counter
    },
    complete : function() {    /// Runs once the data has been processed
      Radar.finish();
      lyAxis = new Rickshaw.Graph.Axis.Y.Scaled({   /// Push new axis to the graph
              graph: graph,                         // Graph to push to
              orientation: 'left',                  // Side of graph to push to
              element: document.getElementById("axis0"),  // Container to place inside
              width: 40,                            // Width to draw axis
              height: graph.height,                 // Height of the axis
              scale: Radar.scale,                   // Scale to number by
              tickFormat: Rickshaw.Fixtures.Number.formatKMBT // How to label the axis ticks
      });
      annotator.add(Radar.max.x, "RADAR Apogee");               // Denote the apogee
      annotator.update();                                       // Draw denotation
      updateGraph();  // Update the graph
      console.log(rows + " RADAR entries processed in " + (performance.now()-start).toFixed(2) + " ms");  // Report how long it took
    }
  });
  document.getElementById('list').innerHTML = files[0].name;  // Write the name of the last file parsed
}

function rocFileSelect(evt) {
  var start = performance.now();  // For performance metric
  var files = evt.target.files;   // File is provided by target
  var time      = 0;              // Current time is 0
  var rows      = 0;              // No rows processed yet
  var index     = 0;              // Index of the current value
  Current     = new dataSet('Current', 'mA');
  Voltage     = new dataSet('Voltage', 'mV');
  hxGyro      = new dataSet('High Gyroscope (Hz, x-axis)', 'Hz');
  hyGyro      = new dataSet('High Gyroscope (Hz, y-axis)', 'Hz');
  hzGyro      = new dataSet('High Gyroscope (Hz, z-axis)', 'Hz');
  xGyro       = new dataSet('Gyroscope (Hz, x-axis)', 'Hz');  // Create gyro-x dataset
  yGyro       = new dataSet('Gyroscope (Hz, y-axis)', 'Hz');  // Create gyro-y dataset
  zGyro       = new dataSet('Gyroscope (Hz, z-axis)', 'Hz');  // Create gyro-z dataset
  xAccel      = new dataSet('Accelerometer (G, x-axis)', 'G');
  yAccel      = new dataSet('Accelerometer (G, y-axis)', 'G');
  zAccel      = new dataSet('Accelerometer (G, z-axis)', 'G');
  xMag        = new dataSet('Magnetometer (x-axis)', 'Gauss');
  yMag        = new dataSet('Magnetometer (y-axis)', 'Gauss');
  zMag        = new dataSet('Magnetometer (z-axis)', 'Gauss');
  hzAccel     = new dataSet('Accelerometer (G, z-axis)', 'G');   // Create high g accel-z dataset
  Papa.parse(files[0], {          /// Parse the file
    dynamicTyping : true,         // Convert strings to values
    delimiter : "",               // Determine delimiter automatically
    step: function(row, handle) { /// Handler for each line
      if (typeof (row.data[0][0]) == 'number' && row.data[0][0] <= (MAX_TIME * 1000)) { /// If a numerical time and within timeframe
        var time    = row.data[0][0] / 1000;      // Time in seconds
        var cur     = row.data[0][1];
        var vol     = row.data[0][2];
        var haz     = row.data[0][3];
        var hgx     = row.data[0][4];
        var hgy     = row.data[0][5];
        var hgz     = row.data[0][6];
        var ax      = row.data[0][7];
        var ay      = row.data[0][8];
        var az      = row.data[0][9];
        var gx      = row.data[0][10];
        var gy      = row.data[0][11];
        var gz      = row.data[0][12];
        var mx      = row.data[0][13];
        var my      = row.data[0][14];
        var mz      = row.data[0][15];

        //// Low Accelerometer ////
        xAccel.raw.push({x: time, y: (ax * 0.000183)});
        yAccel.raw.push({x: time, y: (ay * 0.000183)});
        zAccel.raw.push({x: time, y: (az * 0.000183)});

        //// High Accelerometer ////
        hzAccel.raw.push({x: time, y: (0.6125*(haz-512))});

        //// Gyroscope ////
        xGyro.raw.push({x: time, y: (gx * 0.0001695)}); // New gx value in Hz
        yGyro.raw.push({x: time, y: (gy * 0.0001695)}); // New gy value in Hz
        zGyro.raw.push({x: time, y: (gz * 0.0001695)}); // New gz value in Hz

        hxGyro.raw.push({x: time, y: (hgx * 0.000339)}); // New gx value in Hz
        hyGyro.raw.push({x: time, y: (hgy * 0.000339)}); // New gy value in Hz
        hzGyro.raw.push({x: time, y: (hgz * 0.000339)}); // New gz value in Hz

        xMag.raw.push({x: time, y: (mx * 0.000061)});
        yMag.raw.push({x: time, y: (my * 0.000061)});
        zMag.raw.push({x: time, y: (mz * 0.000061)});

        Current.raw.push({x: time, y: ((cur-2500)*1.04)});  // Push new value
        Voltage.raw.push({x: time, y: vol});  // Push new value

        index++;  // Next data point
        }
      rows++;
    },
    complete : function() {
      Current.finish();
      Voltage.finish();
      hxGyro.finish();
      hyGyro.finish();
      hzGyro.finish();
      xGyro.finish();
      yGyro.finish();
      zGyro.finish();
      xAccel.finish();
      yAccel.finish();
      zAccel.finish();
      xMag.finish();
      yMag.finish();
      zMag.finish();
      hzAccel.finish();

      y2Axis = new Rickshaw.Graph.Axis.Y.Scaled({
                graph: graph,
                orientation: 'left',
                element: document.getElementById("axis1"),
                width: 40,
                height: graph.height,
                scale: hxGyro.scale,
                tickFormat: Rickshaw.Fixtures.Number.formatKMBT
      });
      updateGraph();
      console.log(rows + " Payload entries processed in " + (performance.now()-start).toFixed(2) + " ms");
    }
  });
  document.getElementById('list').innerHTML = files[0].name;
}

function initGraph() {    /// Create and display the graph
        graph = new Rickshaw.Graph( {   /// Create a new graph object
                element: document.getElementById("chart"),  // Container for the graph
                renderer: 'multi',                          // How we want to render the graph
                width: document.getElementById("graphContainer").offsetWidth-120, // How wide the graph should be
                height: window.innerHeight-205,             // How tall the graph should be
                dotSize: 5,
                series: Series                              // What this graph contains
        });
        palette = new Rickshaw.Color.Palette( { scheme: 'spectrum14' } ); // The selected color palette
        annotator = new Rickshaw.Graph.Annotate({   /// Create a new annotation bar
                graph: graph,                       // What graph to attach to
                element: document.getElementById("timeline")  // Container for the annotator
        });
        legend = new Rickshaw.Graph.Legend({    /// Create a new legend for the graph
                graph: graph,                   // What graph to attatch to
                element: document.getElementById("legend")  // Container for the legend
        });
        slider = new Rickshaw.Graph.RangeSlider.Preview({   /// Create a new slider
                graph: graph,                               // What graph to attatch to
                height: 100,                                // How tall the slider should be
                element: document.getElementById("slider")  // Container for the slider
        });
        var xAxis = new Rickshaw.Graph.Axis.X({   /// Create a new x-axis
                graph: graph                      // Graph to attatch the x-axis to
        });
}

function updateGraph() {
        $('#legend').empty();   // Clear the legend container
        $('#slider').empty();   // Clear the slider container
        legend = new Rickshaw.Graph.Legend({  /// Create a new legend
                graph: graph,                 // What graph to attatch to
                element: document.getElementById("legend")  // Container for the legend
        });
        slider = new Rickshaw.Graph.RangeSlider.Preview({   /// Create a new range slider
                graph: graph,                               // What graph to attatch to
                height: 100,                                // How tall the slider should be
                element: document.getElementById("slider")  // Container for the slider
        });
        shelving = new Rickshaw.Graph.Behavior.Series.Toggle( {   /// Create new toggle action
                graph: graph,                                     // What graph to attatch to
                legend: legend                                    // What legend to attatch to
        });
        hoverDetail = new Rickshaw.Graph.HoverDetail( {   /// Show details whole hovering
                graph: graph,                             // Graph to attatch to
                formatter: function(series, x, y) {         /// Define how to display the x values
                        if(y2Axis.scale != series.scale){
                          y2Axis.scale = series.scale;
                          setTimeout(function(){ graph.update(); }, 50);
                        }
                        return (x.toFixed(2) + " seconds, " + y.toFixed(2) + " " + series.format);  // Display as seconds and value
                }
        });
        graph.update();   // Update the graph
        graph.render();   // Draw the updated graph
}

// This function is ported from an example given by Sveinn Steinarsson
// His research is available here:
// http://skemman.is/stream/get/1946/15343/37285/3/SS_MSthesis.pdf
function largestTriangleThreeBuckets(data, threshold) {
        var 	ceil = Math.ceil,          // Alias for the Ceiling function
              abs = Math.abs;            // Alias for the Absolute value function
        var   data_length = data.length; // Length of the input
        if (threshold >= data_length || threshold === 0) { /// Check if we have enough points
                return sampled; // Nothing to do
        }

        var sampled = [];       // Empty the output array
        var sampled_index = 0;  // Keeps track of where we are

        // Bucket size. Leave room for start and end data points
        var every = (data_length - 2) / (threshold - 2);

        var     a = 0,  // Initially a is the first point in the triangle
                max_area,
                area,
                next_a;

        sampled[ sampled_index++ ] = data[ a ]; // Always add the first point

                // Determine the boundaries for the current and next buckets
        var     bucket_start	= 0,
                bucket_center 	= ceil( every );

        for (var i = 0; i < threshold - 2; i++) {
          // Calculate the boundary of the third bucket
          var     bucket_end 		= ceil( (i + 2) * every );

          // Calculate point average for next bucket (containing c)
          var     avg_x = 0,
                  avg_y = 0,
                  avg_range_start  = bucket_center,
                  avg_range_end    = bucket_end;
          avg_range_end = avg_range_end < data_length ? avg_range_end : data_length;

          var     avg_range_length = avg_range_end - avg_range_start;

          for ( ; avg_range_start<avg_range_end; avg_range_start++ ) {
                  avg_x += data[ avg_range_start ].x * 1; // * 1 enforces Number (value may be Date)
                  avg_y += data[ avg_range_start ].y * 1;
          }
          avg_x /= avg_range_length;
          avg_y /= avg_range_length;

          // Get the range for this bucket
          var     range_offs = bucket_start,
                  range_to   = bucket_center;

          // Point a
          var     point_a_x = data[ a ].x * 1, // enforce Number (value may be Date)
                  point_a_y = data[ a ].y * 1;

          max_area = area = -1;

          // 2D Vector for A-C
          var     base_x = point_a_x - avg_x,
                  base_y = avg_y - point_a_y;

          for ( ; range_offs < range_to; range_offs++ ) {
              // Calculate triangle area over three buckets
              area = abs( ( base_x ) * ( data[ range_offs ].y - point_a_y ) -
                          ( point_a_x - data[ range_offs ].x ) * ( base_y )
                        );
              if ( area > max_area ) {
                  max_area = area;
                  next_a = range_offs; // Next a is this b
          }
        }

        sampled[ sampled_index++ ] = data[ next_a ]; // Pick this point from the bucket
        a = next_a; // This a is the next a (chosen b)

        bucket_start 	  = bucket_center;	// Shift the buckets over by one
        bucket_center 	= bucket_end;		// Center becomes the start, and the end becomes the center
    }

    sampled[ sampled_index++ ] = data[ data_length - 1 ]; // Always add last
    return sampled;
}

var resize = function() {
  graph.configure({
    width: document.getElementById("graphContainer").offsetWidth-120, // Set width to 120 less than window
    height: window.innerHeight-205, // Set height to 205 less than window
  });
  graph.render(); // Rerender the graph
}

function init() {   /// Add handlers and start up the graph
  document.getElementById('radFiles').addEventListener('change', radFileSelect, false); // Run the radar parser on file select
  document.getElementById('rocFiles').addEventListener('change', rocFileSelect, false); // Run the rocket parser when given file
  window.addEventListener('resize', resize);  // Resize the graph if the window is resized
  initGraph();  // Create the graph
}

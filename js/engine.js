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
  this.name = name;       // Object identifier, displayed in index
  this.max = {x : -Infinity, y : -Infinity};  // Maximum value
  this.min = {x : Infinity, y : Infinity};    // Minimum value
  this.raw = [];          // Raw data points
  this.sampled = [];      // Downsampled data points
  this.scale = d3.scale.linear().domain([0, 100]).nice(); // Scale for this value
}

var Series = [];  // Array of data to graph
var Scales = [];  // Approprate scales for the axes

//// FUNCTIONS ////
function radFileSelect(evt) {
  var start = performance.now();  // For timing the file process
  Radar = new dataSet('RADAR Altitude (m)');   // Create Radar dataset
  var rows = 0;                   // Number of rows processed
  var index = 0;                  // Index of the current value
  var steps = 1;                  // Number of steps in this tenth-second
  var first = true;               // This is the first valid radar value
  var offset = 0;                 // The inital altitude of the rocket
  var files = evt.target.files;   // The file object to get data from
  Papa.parse(files[0], {          // Process the csv file
    dynamicTyping : true,         // Create numbers from detected values
    delimiter : "",               // Automatically determine the delimiter
    step: function(row, handle) {   /// Runs each row of processed data
      if (typeof (row.data[0][0]) == 'number') {    /// If valid, process
        var time = row.data[0][0];    // Determine time to nearest tenth of a second
        if (time > MAX_TIME) return;
        if (first) {                 /// Run only once
          offset = row.data[0][3];   // Use the initial height as base
        }
        if (Radar.raw[index] && Radar.raw[index].x == time) {     /// If still in the same tenth-second
          Radar.raw[index].y += (row.data[0][3]-offset); // Add in the altitude
          steps++;                       // Note the number of combined values
        }
        else {    /// If in a new second
          if(Radar.raw[index-1]) {  /// If not the first value
            Radar.raw[index-1].y *= (0.3048/steps);  // Convert to meters and average
            if (Radar.raw[index-1].y > Radar.max.y)  /// Check if new max
              Radar.max = Radar.raw[index-1];        // If new max, copy
            if (Radar.raw[index-1].y < Radar.min.y)  /// Check if new min
              Radar.min = Radar.raw[index-1];        // If new min, copy
          }
          steps = 1;  // Reset steps to 1
          index++;
          Radar.raw.push({x: row.data[0][0], y: (row.data[0][3]-offset)}); // Add a new point
        }
        first = false;  // No longer in the first value
      }
      rows++;   // Increment row counter
    },
    complete : function() {    /// Runs once the data has been processed
      Scales[0] = d3.scale.linear().domain([0, Radar.max.y]).nice(); // Scale the y axis, 0 to maximum altitude
      annotator.add(Radar.max.x, "RADAR Apogee");               // Denote the apogee
      annotator.update();                                       // Draw denotation
      Radar.sampled = largestTriangleThreeBuckets(Radar.raw, MAX_POINTS); // Downsample the radar data
      Series.push({                         /// Push to the graph
              name: Radar.name,             // Name
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

function rocFileSelect(evt) {
  var start = performance.now();  // For performance metric
  var files = evt.target.files;   // File is provided by target
  var time      = 0;              // Current time is 0
  var rows      = 0;              // No rows processed yet
  var index     = 0;              // Index of the current value
  Geiger      = new dataSet('Geiger Counts');           // Create geiger dataset
  Temperature = new dataSet('Temperature (deg C)');     // Create temperature dataset
  Pressure    = new dataSet('Pressure (kPa)');          // Create pressure dataset
  Humidity    = new dataSet('Humidity');                // Create humididty dataset
  xGyro       = new dataSet('Gyroscope (Hz, x-axis)');  // Create gyro-x dataset
  yGyro       = new dataSet('Gyroscope (Hz, y-axis)');  // Create gyro-y dataset
  zGyro       = new dataSet('Gyroscope (Hz, z-axis)');  // Create gyro-z dataset
  lxAccel = new dataSet('Accelerometer (G, x-axis)');   // Create low accel-x dataset
  lyAccel = new dataSet('Accelerometer (G, y-axis)');   // Create low accel-y dataset
  lzAccel = new dataSet('Accelerometer (G, z-axis)');   // Create low accel-z dataset
  mxAccel = new dataSet('Accelerometer (G, x-axis)');   // Create med accel-x dataset
  myAccel = new dataSet('Accelerometer (G, y-axis)');   // Create med accel-y dataset
  mzAccel = new dataSet('Accelerometer (G, z-axis)');   // Create med accel-z dataset
  hzAccel = new dataSet('Accelerometer (G, z-axis)');   // Create high g accel-z dataset
  Papa.parse(files[0], {          /// Parse the file
    dynamicTyping : true,         // Convert strings to values
    delimiter : "",               // Determine delimiter automatically
    step: function(row, handle) { /// Handler for each line
      // Clears out empty array elements left by the parser
      row.data[0].forEach(function(obj, index, arr){if(obj == ""){arr.splice(index, 1);}});
      if (typeof (row.data[0][0]) == 'number' && row.data[0][0] <= (MAX_TIME * 1000)) { /// If a numerical time and within timeframe
        var msTime  = row.data[0][0];     // Time in ms
        var time    = msTime / 1000;      // Time in seconds
        var lax     = row.data[0][1];     // Low accelerometer x
        var lay     = row.data[0][2];     // Low accelerometer y
        var laz     = row.data[0][3];     // Low accelerometer z
        var max     = row.data[0][4];     // Med accelerometer x
        var may     = row.data[0][5];     // Med accelerometer y
        var maz     = row.data[0][6];     // Med accelerometer z
        var haz     = row.data[0][7];     // High accelerometer z
        var temp    = row.data[0][8];     // Temperature
        var press   = row.data[0][9];     // Pressure
        var gx      = row.data[0][10];    // Gyroscope x
        var gy      = row.data[0][11];    // Gyroscope y
        var gz      = row.data[0][12];    // Gyroscope z
        var gCount  = row.data[0][13];    // Geiger count
        var humid   = row.data[0][14];    // Humidity

        //// Low Accelerometer ////
        lxAccel.raw.push({x: time, y: (lax-335)/61.2});
        lyAccel.raw.push({x: time, y: (lay-335)/61.2});
        lzAccel.raw.push({x: time, y: (laz-335)/61.2});
        if (lxAccel.raw[index].y > lxAccel.max.y) // If new max
          lxAccel.max = lxAccel.raw[index];
        else if (lxAccel.raw[index].y < lxAccel.min.y) // If new min
          lxAccel.min = lxAccel.raw[index];
        if (lyAccel.raw[index].y > lyAccel.max.y) // If new max
          lyAccel.max = lyAccel.raw[index];
        else if (lyAccel.raw[index].y < lyAccel.min.y) // If new min
          lyAccel.min = lyAccel.raw[index];
        if (lzAccel.raw[index].y > lzAccel.max.y) // If new max
          lzAccel.max = lzAccel.raw[index];
        else if (lzAccel.raw[index].y < lzAccel.min.y) // If new min
          lzAccel.min = lzAccel.raw[index];

        //// Med Accelerometer ////
        mxAccel.raw.push({x: time, y: (max-335)/12.9});
        myAccel.raw.push({x: time, y: (may-335)/12.9});
        mzAccel.raw.push({x: time, y: (maz-335)/12.9});
        if (mxAccel.raw[index].y > mxAccel.max.y) // If new max
          mxAccel.max = mxAccel.raw[index];
        else if (mxAccel.raw[index].y < mxAccel.min.y) // If new min
          mxAccel.min = mxAccel.raw[index];
        if (myAccel.raw[index].y > myAccel.max.y) // If new max
          myAccel.max = myAccel.raw[index];
        else if (myAccel.raw[index].y < myAccel.min.y) // If new min
          myAccel.min = myAccel.raw[index];
        if (mzAccel.raw[index].y > mzAccel.max.y) // If new max
          mzAccel.max = mzAccel.raw[index];
        else if (mzAccel.raw[index].y < mzAccel.min.y) // If new min
          mzAccel.min = mzAccel.raw[index];

        //// High Accelerometer ////
        hzAccel.raw.push({x: time, y: (max-510)/7.76});
        if (hzAccel.raw[index].y > hzAccel.max.y) // If new max
          hzAccel.max = hzAccel.raw[index];
        else if (hzAccel.raw[index].y < hzAccel.min.y) // If new min
          hzAccel.min = hzAccel.raw[index];

        //// Temperature ////
        Temperature.raw.push({x: time, y: temp/10});  // New temperature in deg C
        if (Temperature.raw[index].y > Temperature.max.y) // If new max
          Temperature.max = Temperature.raw[index];
        else if (Temperature.raw[index].y < Temperature.min.y) // If new min
          Temperature.min = Temperature.raw[index];

        //// Pressure ////
        Pressure.raw.push({x: time, y: press/1000 }); // Pressure in kPa
        if (Pressure.raw[index].y > Pressure.max.y) // If new max
          Pressure.max = Pressure.raw[index];
        else if (Pressure.raw[index].y < Pressure.min.y) // If new min
          Pressure.min = Pressure.raw[index];

        //// Gyroscope ////
        xGyro.raw.push({x: time, y: gx/5175}); // New gx value in Hz
        yGyro.raw.push({x: time, y: gy/5175}); // New gy value in Hz
        zGyro.raw.push({x: time, y: gz/5175}); // New gz value in Hz
        if (xGyro.raw[index].y > xGyro.max.y) // If new max
          xGyro.max = xGyro.raw[index];
        else if (xGyro.raw[index].y < xGyro.min.y) // If new min
          xGyro.min = xGyro.raw[index];
        if (yGyro.raw[index].y > yGyro.max.y) // If new max
          yGyro.max = yGyro.raw[index];
        else if (yGyro.raw[index].y < yGyro.min.y) // If new min
          yGyro.min = yGyro.raw[index];
        if (zGyro.raw[index].y > zGyro.max.y) // If new max
          zGyro.max = zGyro.raw[index];
        else if (zGyro.raw[index].y < zGyro.min.y) // If new min
          zGyro.min = zGyro.raw[index];

        //// Geiger Counter ////
        Geiger.raw.push({x: time, y: gCount});  // Push new value
        if (Geiger.raw[index].y > Geiger.max.y) // If new max
          Geiger.max = Geiger.raw[index];
        else if (Geiger.raw[index].y < Geiger.min.y) // If new min
          Geiger.min = Geiger.raw[index];

        //// Humidity ////
        Humidity.raw.push({x: time, y: humid/1023 }); // Humidity value in %, uncompensated
        if (Humidity.raw[index].y > Humidity.max.y) // If new max
          Humidity.max = Humidity.raw[index];
        else if (Humidity.raw[index].y < Humidity.min.y) // If new min
          Humidity.min = Humidity.raw[index];

        index++;  // Next data point
        }
      rows++;
    },
    complete : function() {
      Geiger.sampled      = largestTriangleThreeBuckets(Geiger.raw, MAX_POINTS);
      Temperature.sampled = largestTriangleThreeBuckets(Temperature.raw, MAX_POINTS);
      Pressure.sampled    = largestTriangleThreeBuckets(Pressure.raw, MAX_POINTS);
      Humidity.sampled    = largestTriangleThreeBuckets(Humidity.raw, MAX_POINTS);
      xGyro.sampled       = largestTriangleThreeBuckets(xGyro.raw, MAX_POINTS);
      yGyro.sampled       = largestTriangleThreeBuckets(yGyro.raw, MAX_POINTS);
      zGyro.sampled       = largestTriangleThreeBuckets(zGyro.raw, MAX_POINTS);
      lxAccel.sampled = largestTriangleThreeBuckets(lxAccel.raw, MAX_POINTS);
      lyAccel.sampled = largestTriangleThreeBuckets(lyAccel.raw, MAX_POINTS);
      lzAccel.sampled = largestTriangleThreeBuckets(lzAccel.raw, MAX_POINTS);
      mxAccel.sampled = largestTriangleThreeBuckets(mxAccel.raw, MAX_POINTS);
      myAccel.sampled = largestTriangleThreeBuckets(myAccel.raw, MAX_POINTS);
      mzAccel.sampled = largestTriangleThreeBuckets(mzAccel.raw, MAX_POINTS);
      hzAccel.sampled = largestTriangleThreeBuckets(hzAccel.raw, MAX_POINTS);

      Geiger.scale      = d3.scale.linear().domain([Geiger.min.y, Geiger.max.y]).nice();
      Temperature.scale = d3.scale.linear().domain([Temperature.min.y, Temperature.max.y]).nice();
      Pressure.scale    = d3.scale.linear().domain([Pressure.min.y, Pressure.max.y]).nice();
      Humidity.scale    = d3.scale.linear().domain([Humidity.min.y, Humidity.max.y]).nice();
      xGyro.scale       = d3.scale.linear().domain([xGyro.min.y, xGyro.max.y]).nice();
      yGyro.scale       = d3.scale.linear().domain([yGyro.min.y, yGyro.max.y]).nice();
      zGyro.scale       = d3.scale.linear().domain([zGyro.min.y, zGyro.max.y]).nice();
      lxAccel.scale     = d3.scale.linear().domain([lxAccel.min.y, lxAccel.max.y]).nice();
      lyAccel.scale     = d3.scale.linear().domain([lyAccel.min.y, lyAccel.max.y]).nice();
      lzAccel.scale     = d3.scale.linear().domain([lzAccel.min.y, lzAccel.max.y]).nice();
      mxAccel.scale     = d3.scale.linear().domain([mxAccel.min.y, mxAccel.max.y]).nice();
      myAccel.scale     = d3.scale.linear().domain([myAccel.min.y, myAccel.max.y]).nice();
      mzAccel.scale     = d3.scale.linear().domain([mzAccel.min.y, mzAccel.max.y]).nice();
      hzAccel.scale     = d3.scale.linear().domain([hzAccel.min.y, hzAccel.max.y]).nice();

      Series.push({
              name: Geiger.name,
              data: Geiger.sampled,
              scale: Geiger.scale,
              color: palette.color(),
              renderer: 'line'
      });
      Series.push({
              name: zGyro.name,
              data: zGyro.sampled,
              color: palette.color(),
              scale: zGyro.scale,
              renderer: 'line'
      });
      Series.push({
              name: Temperature.name,
              data: Temperature.sampled,
              color: palette.color(),
              scale: Temperature.scale,
              renderer: 'line'
      });
      Series.push({
              name: Pressure.name,
              data: Pressure.sampled,
              color: palette.color(),
              scale: Pressure.scale,
              renderer: 'line'
      });
      Series.push({
              name: Humidity.name,
              data: Humidity.sampled,
              color: palette.color(),
              scale: Humidity.scale,
              renderer: 'line'
      });
      y2Axis = new Rickshaw.Graph.Axis.Y.Scaled({
              graph: graph,
              orientation: 'left',
              element: document.getElementById("axis1"),
              width: 40,
              height: graph.height,
              scale: Pressure.scale,
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
        highlighter = new Rickshaw.Graph.Behavior.Series.Highlight( {   /// Create a highlight action
                graph: graph,                                           // What graph to attatch to
                legend: legend                                          // What legend to base values on
        });
        shelving = new Rickshaw.Graph.Behavior.Series.Toggle( {   /// Create new toggle action
                graph: graph,                                     // What graph to attatch to
                legend: legend                                    // What legend to attatch to
        });
        hoverDetail = new Rickshaw.Graph.HoverDetail( {   /// Show details whole hovering
                graph: graph,                             // Graph to attatch to
                xFormatter: function(x, series) {         /// Define how to display the x values
                        return (x + " seconds");          // Display as seconds (e.x. "2 seconds")
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

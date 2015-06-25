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
    complete : function(results) {    /// Runs once the data has been processed
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
                xFormatter: function(x) {                 /// Define how to display the x values
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
        var 	ceil = Math.ceil,
                abs = Math.abs;
        var data_length = data.length;
        if (threshold >= data_length || threshold === 0) {
                return data; // Nothing to do
        }

        var     sampled = [],
                sampled_index = 0;

        // Bucket size. Leave room for start and end data points
        var every = (data_length - 2) / (threshold - 2);

        var a = 0,  // Initially a is the first point in the triangle
                max_area,
                area,
                next_a;

        sampled[ sampled_index++ ] = data[ a ]; // Always add the first point

                // Determine the boundaries for the current and next buckets
        var     bucket_start	= 0,
                bucket_center 	= ceil( every );

        for (var i = 0; i < threshold - 2; i++) {
                // Calculate the boundary of the third bucket
                var bucket_end 		= ceil( (i + 2) * every );

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
                    var base_x = point_a_x - avg_x,
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

                    bucket_start 	= bucket_center;	// Shift the buckets over by one
                    bucket_center 	= bucket_end;		// Center becomes the start, and the end becomes the center
    }

    sampled[ sampled_index++ ] = data[ data_length - 1 ]; // Always add last

    return sampled;
}

function init() {   /// Add handlers and start up the graph
  document.getElementById('radFiles').addEventListener('change', radFileSelect, false); // Run the radar parser on file select
  initGraph();  // Create the graph
}

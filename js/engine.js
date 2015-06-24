
// Config
var DEBUG = false;      // Spits out a lot of data that makes debugging helpful
                        // Slows things down a LOT.
var MAX_POINTS  = 500;  // Maximum number of points in the graph per data set
var MAX_TIME    = 500;  // How long to look at data for, in seconds

///// Globals ////

// Raw data, Downsampled
var Data = [ [], [], // Radar
             [], [], // Geiger
             [], [], // Gyro
             [], [], // Temperature
             [], [], // Pressure
             [], []  // Humiditiy
             ]

// I forgot what I was doing here, but it's important. f#%$ me
var MetaData = [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
               ]

// All graphable data
var Series = [];
// The various scales used by the graphs
var Scales = [];

// The first value of Radar, to set position relative to 0
var offset;
// Counter for rows processed
var rows = 0;
// For averaging multiple files
var samples = 0;
// For the minimum and maximum scale values
var max = 0;
var min = 0;
// For position calculation
var vel = [0, 0, 0];
var pos = [0, 0, 0];
var lastTime = 0;
// Debug output
if(DEBUG){ result = []; }
var     velocity = [],
        acceleration = [],
        position = [];

function radFileSelect(evt) {
        var start = performance.now();
        rows = 0;
        var first = true;
        if(DEBUG){ result = []; }
        var files = evt.target.files;
        // This block processes the Radar file and creates a graph for it.
        Papa.parse(files[0], {
                dynamicTyping : true,
                delimiter : "",
                step: function(row, handle) {
                        if (DEBUG) { result.push(row); }
                        // If valid, send to the aggregator
                        if (typeof (row.data[0][0]) == 'number') {
                                stepRadar(row, first);
                                first = false;
                        }
                        rows++;
                },
                complete : function(results) {
                        finalizeRADAR();
                        console.log(rows + " RADAR entries processed in " + (performance.now()-start).toFixed(2) + " ms");
                }
        });
        document.getElementById('list').innerHTML = files[0].name;
}

// Processing routine for the Radar data
function stepRadar(a, first) {

        // Determine the time to nearest second, rounded up
        var time = Math.ceil(a.data[0][0]*10);

        // For the first step only, get the offset value to base altitude at 0
        if (first) {
                offset = a.data[0][3];
        }

        // If still in the same second
        if (Data[0][time-1]) {
                Data[0][time-1].y += (a.data[0][3]-offset); // Add in the altitude
                Data[0][time-1].steps++;    // Note the number of combined values
        }
        // If in a new second
        else {
                Data[0].push({x: time/10, y: (a.data[0][3]-offset), steps: 1}); // Add a new point
        }
}

function finalizeRADAR() {
        var max = {x : 0, y : 0};
        Data[0].forEach(function(obj){obj.y *= (0.3048/obj.steps)});
        Data[0].forEach(function(obj){
                if(obj.y > max.y){
                        max.y = obj.y;
                        max.x = obj.x;
                        }
                });
        Scales[0] = d3.scale.linear().domain([0, max.y]).nice();
        annotator.add(max.x, "RADAR Apogee");
        annotator.update();

        // push the data and render the chart
        Data[1] = largestTriangleThreeBuckets(Data[0], MAX_POINTS);

        Series.push({
                name: 'RADAR Altitude (m)',
                data: Data[1],
                scale: Scales[0],
                color: palette.color(),
                renderer: 'line'
        });
        var yAxis = new Rickshaw.Graph.Axis.Y.Scaled({
                graph: graph,
                orientation: 'left',
                element: document.getElementById("axis0"),
                width: 40,
                height: graph.height,
                scale: Scales[0],
                tickFormat: Rickshaw.Fixtures.Number.formatKMBT
        });

        updateGraph();
}

function rocFileSelect(evt) {
        var start = performance.now();
        var files = evt.target.files;
        time = 0;
        rows = 0;
        if(DEBUG){ result = []; }
        samples++;
        // This block will process the Payload data
        Papa.parse(files[0], {
                dynamicTyping : true,
                delimiter : "",
                step: function(row, handle) {
                        // Clears out empty array elements left by the parser
                        row.data[0].forEach(function(obj, index, arr){if(obj == ""){arr.splice(index, 1);}});
                        if (DEBUG) { result.push(row); }
                        // If valid data, send to the aggregator
                        if (typeof (row.data[0][0]) == 'number' && row.data[0][0] <= 1000000) {
                                stepPayload(row);
                        }
                        rows++;
                },
                complete : function(results) {
                        finalizePAYLOAD();
                        console.log(rows + " Payload entries processed in " + (performance.now()-start).toFixed(2) + " ms");
                }
        });
        document.getElementById('list').innerHTML = files[0].name;
}

// Payload processing routine
function stepPayload(a) {
        var currentTime = a.data[0][0];     // Time in ms
        var time = currentTime/1000;        // Time in seconds
        var halfTime = currentTime/500;     // Time in half-seconds

        // Geiger Counter
        var gCount = a.data[0][13];
        MetaData[1][0] = gCount < MetaData[1][0] ? gCount : MetaData[1][0];
        MetaData[1][1] = gCount > MetaData[1][1] ? gCount : MetaData[1][1];
        if (Data[2][time-1]) {
                Data[2][time-1].y += (gCount * (1/samples));
        }
        else {
                Data[2].push({x: time, y: (gCount * (1/samples))});
        }

        // Gyroscopic Data, Z-axis (Converted to Hz)
        var H = a.data[0][12]/5175;
        Data[4].push({x: time, y: H});
        MetaData[2][0] = H < MetaData[2][0] ? H : MetaData[2][0];
        MetaData[2][1] = H > MetaData[2][1] ? H : MetaData[2][1];

        // Temperature (Deg C)
        var T = (a.data[0][8] / 10);
        Data[6].push({x: a.data[0][0]/1000, y: T});
        MetaData[3][0] = T < MetaData[3][0] ? T : MetaData[3][0];
        MetaData[3][1] = T > MetaData[3][1] ? T : MetaData[3][1];

        // Pressure (kPa)
        var P = (a.data[0][9] / 1000);
        Data[8].push({x: a.data[0][0]/1000, y: P });
        MetaData[4][0] = P < MetaData[4][0] ? P : MetaData[4][0];
        MetaData[4][1] = P > MetaData[4][1] ? P : MetaData[4][1];

        // Humidity
        var V = (a.data[0][14] / 1023) // Voltage read from humidity module
        Data[10].push({x: a.data[0][0]/1000, y: (T*(0.0557419-(0.348387*V))+(170.097*V)-27.2155)}); // Compensated for temperature
        MetaData[1][0] = 0;
        MetaData[1][1] = 100;

        // Accelerometer Data routines
        var delta = currentTime - lastTime;     // Time passed since last point
        var accel = [0, 0, 0];                  // Holds current 3 axis acceleration
        var count = [0, 0, 0];                  // Number of values to average
        if (120 < a.data[0][2] < 550) {
               accel[0] += (a.data[0][2]-335)/61.2;
               count[0]++;
        }
        if (120 < a.data[0][3] < 550) {
               accel[1] += (a.data[0][3]-335)/61.2;
               count[1]++;
        }
        if (120 < a.data[0][4] < 550) {
               accel[2] += (a.data[0][4]-335)/61.2;
               count[2]++;
        }
        if (30 < a.data[0][5] < 650) {
               accel[0] += (a.data[0][5]-335)/12.9;
               count[0]++;
        }
        if (30 < a.data[0][6] < 650) {
               accel[1] += (a.data[0][6]-335)/12.9;
               count[1]++;
        }
        if (30 < a.data[0][7] < 650) {
               accel[2] += (a.data[0][7]-335)/12.9;
               count[2]++;
        }
        accel[2] += (a.data[0][8]-510)/7.76;
        count[2]++;

        accel[0] /= count[0];
        accel[1] /= count[1];
        accel[2] /= count[2];
        acceleration.push(accel[2]);

        vel[0] += accel[0]*delta;
        vel[1] += accel[1]*delta;
        vel[2] += accel[2]*delta;
        velocity.push(vel[2]);

        pos[0] += vel[0]*delta;
        pos[1] += vel[1]*delta;
        pos[2] += vel[2]*delta;
        position.push(pos[2]);

        lastTime = currentTime;
}

function finalizePAYLOAD(){
        // Render the chart
        Data[3] = largestTriangleThreeBuckets(Data[2], MAX_POINTS);
        Data[5] = largestTriangleThreeBuckets(Data[4], MAX_POINTS);
        Data[7] = largestTriangleThreeBuckets(Data[6], MAX_POINTS);
        Data[9] = largestTriangleThreeBuckets(Data[8], MAX_POINTS);
        Data[11] = largestTriangleThreeBuckets(Data[10], MAX_POINTS);
        for (var i = 1; i < MetaData.length; i++) {
                min = min < MetaData[i][0] ? min : MetaData[i][0];
                max = max > MetaData[i][1] ? max : MetaData[i][1];
        }
        Scales[1] = d3.scale.linear().domain([min, max]).nice();
        Series.push({
                name: 'Geiger Counts (Cps)',
                data: Data[3],
                scale: Scales[1],
                color: palette.color(),
                renderer: 'line'
        });
        Series.push({
                name: 'Gyroscope (Hz, Z-Axis)',
                data: Data[5],
                color: palette.color(),
                scale: Scales[1],
                renderer: 'line'
        });
        Series.push({
                name: 'Temperature (Deg C)',
                data: Data[7],
                color: palette.color(),
                scale: Scales[1],
                renderer: 'line'
        });
        Series.push({
                name: 'Pressure (kPa)',
                data: Data[9],
                color: palette.color(),
                scale: Scales[1],
                renderer: 'line'
        });
        Series.push({
                name: 'Humidity (%)',
                data: Data[11],
                color: palette.color(),
                scale: Scales[1],
                renderer: 'line'
        });
        var yAxis = new Rickshaw.Graph.Axis.Y.Scaled({
                graph: graph,
                orientation: 'left',
                element: document.getElementById("axis1"),
                width: 40,
                height: graph.height,
                scale: Scales[1],
                tickFormat: Rickshaw.Fixtures.Number.formatKMBT
        });
        updateGraph();
}

function initGraph() {
        graph = new Rickshaw.Graph( {
                element: document.getElementById("chart"),
                renderer: 'multi',
                width: document.getElementById("graphContainer").offsetWidth-120,
                height: window.innerHeight-205,
                dotSize: 5,
                series: Series
        });

        palette = new Rickshaw.Color.Palette( { scheme: 'spectrum14' } );

        annotator = new Rickshaw.Graph.Annotate({
                graph: graph,
                element: document.getElementById("timeline")
        });

        legend = new Rickshaw.Graph.Legend({
                graph: graph,
                element: document.getElementById("legend")
        });

        slider = new Rickshaw.Graph.RangeSlider.Preview({
                graph: graph,
                height: 100,
                element: document.getElementById("slider")
        });

        var xAxis = new Rickshaw.Graph.Axis.X({
                graph: graph
        });
}

function updateGraph() {
        $('#legend').empty();
        $('#slider').empty();
        legend = new Rickshaw.Graph.Legend({
                graph: graph,
                element: document.getElementById("legend")
        });
        slider = new Rickshaw.Graph.RangeSlider.Preview({
                graph: graph,
                height: 100,
                element: document.getElementById("slider")
        });
        highlighter = new Rickshaw.Graph.Behavior.Series.Highlight( {
                graph: graph,
                legend: legend
        });
        shelving = new Rickshaw.Graph.Behavior.Series.Toggle( {
                graph: graph,
                legend: legend
        });
        hoverDetail = new Rickshaw.Graph.HoverDetail( {
                graph: graph,
                xFormatter: function(x) {
                        return (x + " seconds");
                }
        });

        graph.update();
        graph.render();
}

function resample ( threshold ){
        if (threshold > MAX_POINTS) {
                console.error("Resample exceeds maximum number of points");
                return;
        }
        for (var i = 0; i < Data.length; i+=2) {
                Data[i+1] = largestTriangleThreeBuckets(Data[i], threshold);
                Series[i/2].data = Data[i+1];
        }
        graph.update();
        graph.render();
}

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

var resize = function() {
        graph.configure({
                width: document.getElementById("graphContainer").offsetWidth-120,
                height: window.innerHeight-205,
        });
        graph.render();
}

// Doesn't work, but needs to
function rescale() {
        min = 0;
        max = 0;
        for (var i = 1; i < MetaData.length; i++) {
                if (graph.series[i].disabled != true) {
                        min = min < MetaData[i][0] ? min : MetaData[i][0];
                        max = max > MetaData[i][1] ? max : MetaData[i][1];
                }
        }
        Scales[1] = d3.scale.linear().domain([min, max]).nice();
        graph.update();
}

function init() {
    document.getElementById('radFiles').addEventListener('change', radFileSelect, false);
    document.getElementById('rocFiles').addEventListener('change', rocFileSelect, false);
    window.addEventListener('resize', resize);
    initGraph();
}

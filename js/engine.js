
// Config
var DEBUG = false;
var MAX_POINTS = 1000;

///// Globals ////

// Raw data, Downsampled
var Data = [ [], [], // Radar
             [], [], // Geiger
             [], []  // Gyro
             ]

// All graphable data
var Series = [];
// The various scales used by the graphs
var Scales = [];

// The first value of Radar, to set position relative to 0
var offset;
// Display counter for rows processed
var rows = 0;
// For averaging multiple files
var samples = 0;
// Placeholders
var max = 0;
var min = 0;
// Debug output
if(DEBUG){ result = []; }

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
                name: 'RADAR Altitude',
                data: Data[1],
                scale: Scales[0],
                color: 'rgba(255, 127, 0, 1.0)',
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
                        if (typeof (row.data[0][0]) == 'number') {
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
        var time = Math.ceil(a.data[0][0]/1000);        // Time in seconds
        var halfTime = Math.ceil(a.data[0][0]/500);     // Time in half-seconds
        
        // Geiger Counter
        if (Data[2][time-1]) {
                Data[2][time-1].y += (a.data[0][13] * (1/samples));
                if (Data[2][time-1].y > max) {
                        max = Data[2][time-1].y;
                }
        }
        else {
                Data[2].push({x: time, y: (a.data[0][13] * (1/samples))});
        }
        
        // Gyroscopic Data (Converted to Hz) 
        Data[4].push({x: a.data[0][0]/1000, y: (a.data[0][12]/5175)});
        if (a.data[0][12]/5175 < min) {
                min = a.data[0][12]/5175;
        }
}

function finalizePAYLOAD(){
        // Render the chart
        Data[3] = largestTriangleThreeBuckets(Data[2], MAX_POINTS);
        Data[5] = largestTriangleThreeBuckets(Data[4], MAX_POINTS);
        Scales[1] = d3.scale.linear().domain([-5, 50]).nice();
        Series.push({
                name: 'Geiger Counts',
                data: Data[3],
                scale: Scales[1],
                color: 'rgba(255, 0, 0, 0.4)',
                renderer: 'line',
        });
        Series.push({
                name: 'Gyroscope',
                data: Data[5],
                color: 'rgba(0, 255, 0, 0.8)',
                scale: Scales[1],
                renderer: 'line',
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

function init() {
    // Handle for the counter
    counter = document.getElementById('progress');
    document.getElementById('radFiles').addEventListener('change', radFileSelect, false);
    document.getElementById('rocFiles').addEventListener('change', rocFileSelect, false);
    window.addEventListener('resize', resize); 
    initGraph();
}

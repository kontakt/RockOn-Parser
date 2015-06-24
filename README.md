This web app creates pretty graphs for the RockOn payload data.

Chrome is recommended, it appears to work in other browsers, but I build and test in chrome.

###Method of operation:
1. Click Download Zip, on the right.
2. Unzip the folder.
3. Open main.html in chrome. (In chrome, ctrl + o and navigate to the file)
4. Use the dialog to open your radar file and payload data in the parser.
  (It's alright if you don't have radar, you will just lack an altitude line.)

###Notes:
The parser will take a few seconds, perhaps as long as a minute to parse the data. This is normal. The graphs are zoomable and scroll.

The code downsamples your data to a thousand points, and cuts off any data after a certain number of seconds. This is configurable, but I haven't built a menu for it yet.

The graphs are dynamically sized based on the data provided and the size of the window, and the shown graphs can be toggled.

The apogee is shown on the bar between the main graph and the minigraph as a dot, this bar is intended to have additional points of interesting data.

###Things to improve (In descending order of utility):
Add configuration menu.

Make axis scale dynamically with selected data.

Add more detected points of interest.

Write algorithm to estimate altitude based on dead reckoning. (Mostly for fun, this will be incredibly inaccurate.)

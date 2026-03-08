# Project Name: Pittsburgh GIS Tree Data Project and Web Visualization

# Overview

I am a volunteer for the Squirrel Hill Urban Coalition tree committee (https://shuc.org/about-us/committees/parks-and-open-space-committee/). As a neighborhood non-profit in Pittsburgh, we promote the health of tree canopy in Squirrel Hill and the greater Pittsburgh area.

My goal is to use GIS data on the tree canopy to create a web map based visualization of the Allegheny tree canopy. There are two main parts to the project, the GIS data synthesis and the web visualization.

## GIS data synthesis

I want to use existing GIS data sources and shape files to synthesize the data into different tree visualization layers. This will be a one-time operation to generate the data that will be displayed on the web. I want the data synthesis to be scripted (e.g. python) and reproducible so that I can publish the methodology to github for others to use.

## Web visualization

I want to publish a map-based visualization on the web that will let community members zoom and search around the data to find areas of interest and understand the tree canopy health for that area. 

# Technical requirements

## Preferred software environment

1. Operating system of GIS data synthesis \= Linux  
2. GIS toolkit and application \= QGIS 3.44  
3. Programming language for data analysis=Python 3  
4. Web framework \= React  
5. Web map framework \= MapLibre GL JS with react-map-gl  
6. Web hosting \= The output of the web visualization should be static HTML, Javascript, etc that can be loaded onto a basic web server without the need for a database or server-side components.

## Source data

The source GIS data is as follows

* Directory: source-gis-data/TreeCanopyChange\_2015\_2020\_AlleghenyCounty.gdb  
  * This contains shapes and attributes for the tree survey and associated Allegheny county showing tree canopy loss, gain or no change between 2015 and 2020\.  
  * Layers:  
    * Municipal\_Boundaries\_2020  
    * Boundary\_AlleghenyCounty  
    * Grid\_2000ft\_AlleghenyCounty  
    * Pittsburgh\_Neighborhoods  
    * Parks\_County  
    * Parks\_Municipal  
    * City\_Council\_Districts  
    * County\_Council\_Districts  
    * Voting\_Districts  
    * Watersheds  
    * Watersheds\_Rivers  
    * Watersheds\_Storm  
    * Parcels\_AlleghenyCounty  
    * Census\_BlockGroups2020  
    * TreeCanopy\_2020\_AlleghenyCounty  
    * TreeCanopyChange\_2015\_2020\_AlleghenyCounty  
    * TreeCanopyGains  
* Directory: source-gis-data/PittsburghRoads/p20/context.gdb  
  * This contains shapes for each street in the city of Pittsburgh.

## GIS parameters

* When defining the zone for street trees, assume it is 50 feet on either side of the center of the street  
* Assume a mature tree has a canopy area of at least 0.04 acres and 2+ mature trees have a canopy area of greater than 0.07 acres  
* The gain/loss change class field values map as follows:  
  * 1 \= No Change to the tree canopy between 2015 and 2020  
  * 2 \= A gain in canopy between 2015 and 2020  
  * 3 \= A loss in canopy between 2015 and 2020  
* There are two methods of calculating the gain/loss areas for analysis and visualization. Calculate both and let the user select which to view:  
  * (1) Gain/loss % with respect to the size of the area of interest. For example if calculating with respect to a neighborhood area of interest of size 10 acres with  a 2015 canopy size of 3 acres and a 2020 canopy area of 1 acre. The canopy loss would be 20% (2 acres lost in a neighborhood of 10 acres).   
  * (2) Gain/loss % with respect to the 2015 tree canopy area. Also provide an option to show the % as a percent of the 2015 canopy size. For example if calculating with respect to a neighborhood area of interest of size 10 acres with a 2015 canopy size of 3 acres and a 2020 canopy area of 1 acre. The canopy loss would be 66% (2 acres lost from a 2015 canopy of size 3 acres).   
* For the GIS data analysis and synthesis, make the incremental output of each step in the analysis process able to be opened and displayed as a layer in QGIS. This way it can be visually inspected incrementally for accuracy and as an audit to the process.

## Web Visualization Use Cases / Features

1. User opens the website and sees a map of Pittsburgh (e.g. OpenStreetMap) with the tree canopy gain/loss regions overlaid on top of it.  
2. Provide layers to view the canopy loss (both methods) by different segmentations. For each segmentation, the user can display the borders, search for a segment by name, select the canopy loss method (relative to size of segment or relative to size of 2015 canopy) and show the canopy gain/loss. Provide segment layers for the following:  
   1. Pittsburgh\_Neighborhoods  
   2. Municipal\_Boundaries\_2020  
   3. Parks\_County  
   4. Parks\_Municipal  
   5. City\_Council\_Districts  
   6. County\_Council\_Districts  
3. Provide the option to limit the above view of gain/losses to “street trees” which only includes the buffer area within 50 feet of the center of a street.  
4. Provide the option to view a street layer which uses the street shapes with a 50 foot buffer on either side of the center of the street (100 foot width total) and calculates the same % loss areas as the primary segments above. Allow the user to search for a street of interest and highlight it on the map.
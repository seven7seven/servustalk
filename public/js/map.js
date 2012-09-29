/*=========================================================== 

  Loads the vizualisation on the map page; adds the markers

===========================================================*/

google.load('visualization', '1', {'packages': ['geochart']});
google.setOnLoadCallback(drawMarkersMap);

function drawMarkersMap() {
  $.ajax({
    url: 'distinctCheckins'
  }).done(function(stats) {
    arr = [['Location', 'Frequency']];
    for (var loc in stats) {
      arr.push([loc, stats[loc]]);
    }
    var data = google.visualization.arrayToDataTable(arr);

    var options = {
      // region: 'IT',
      displayMode: 'markers',
      colorAxis: {colors: ['blue', 'lightBlue']}
    };

    var map = new google.visualization.GeoChart(document.getElementById('map'));
    map.draw(data, options);
  });
};
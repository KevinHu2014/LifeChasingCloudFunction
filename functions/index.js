const functions = require('firebase-functions');
const admin = require('firebase-admin');
var polyUtil = require('polyline-encoded');
var axios = require('axios');

admin.initializeApp();
var temp = [];

function distance(lat1, lon1, lat2, lon2, unit) {
	var radlat1 = Math.PI * lat1/180
	var radlat2 = Math.PI * lat2/180
	var theta = lon1-lon2
	var radtheta = Math.PI * theta/180
	var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
	dist = Math.acos(dist)
	dist = dist * 180/Math.PI
	dist = dist * 60 * 1.1515
	if (unit === "K") { dist = dist * 1.609344 }
	if (unit === "N") { dist = dist * 0.8684 }
	return dist
}

function add_dot(startLat, startLon, endLat, endLon) {
  var midLat = (startLat + endLat) / 2;
  var midLon = (startLon + endLon) / 2;
  if(distance(startLat, startLon, endLat, endLon, "K") > 0.005) {
    add_dot(startLat, startLon, midLat, midLon);
    add_dot(midLat, midLon, endLat, endLon);
  }
  // console.log([midLat, midLon]);
  // temp.push([midLat, midLon]);
  temp.push({ id: Math.floor(Math.random() * 10000) + 1, longitude: midLon, latitude: midLat })
  return temp;
}

function Object_values(obj) {
  let vals = [];
  for (const prop in obj) {
      vals.push(obj[prop]);
  }
  return vals;
}

exports.markerGenerator = functions.database.ref('/marker').onCreate((snap, context) => {
  console.log(snap.val());
  let innerData = Object_values(snap.val())[0];
  // console.log(innerData.key);
  console.log(innerData.startLat);
  console.log(innerData.endLat);
  return new Promise((resolve, reject) => {
    axios.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${innerData.startLat},${innerData.startLon}&destination=${innerData.endLat},${innerData.endLon}&mode=walking&alternatives=true&key=AIzaSyC6u4b84tBPokRRlbVhzXorKh93BzP9OPA`)
    .then((response) => {
      console.log(response.data);
      console.log('QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ');
      if (response.data.routes.length > 0) {
        response.data.routes.map(
            (routes) => {
            var latlngs = polyUtil.decode(routes.overview_polyline.points);
            console.log(routes.overview_polyline)
            for (var i = 0; i < (latlngs.length - 1); i++){
              // console.log(i);
              add_dot(latlngs[i][0], latlngs[i][1], latlngs[i+1][0], latlngs[i+1][1]);
            }
            console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
            // console.log(temp);
            console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
            return true;
          }
        );
        return true;
      }
      console.log('faillllll');
      return true;
    })
    .then(() => {
      resolve('success');
      return snap.ref.child(`/${Object.keys(snap.val())}`).update({
        // key: snap.val().key,
        // startLat: snap.val().startLat,
        // startLon: snap.val().startLon,
        // endLat: snap.val().endLat,
        // endLon: snap.val().endLon,
        data: temp,
        dots: temp.length,
      });
    })
    .catch((err) => {
      console.log('ffffffail');
      console.log(err);
    });
  });
});

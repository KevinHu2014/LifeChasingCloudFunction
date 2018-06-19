const functions = require('firebase-functions');
const admin = require('firebase-admin');
var polyUtil = require('polyline-encoded');
var axios = require('axios');
var _ = require('lodash');

admin.initializeApp();
var temp = [];
var marker = [];

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
  // 如果距離大於 0.0005 公里，則繼續找中點
  if(distance(startLat, startLon, endLat, endLon, "K") > 0.0005) {
    add_dot(startLat, startLon, midLat, midLon);
    add_dot(midLat, midLon, endLat, endLon);
  }
  // console.log([midLat, midLon]);
  // temp.push([midLat, midLon]);
  temp.push({ id: midLon.toString().concat(midLat.toString()), longitude: midLon, latitude: midLat })
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

        // 去除相同的點
        temp = _.uniqBy(temp, 'id');

        return true;
      }
      console.log('faillllll');
      return true;
    })
    .then(() => {
      // 去除距離太近的點
      var k = temp.length;
      for(var i = 0; i < k ; i++) {
        for (var j = i + 1; j < k ; ) {
          var dist = Math.round(distance(temp[i].latitude, temp[i].longitude, temp[j].latitude, temp[j].longitude, "K") * 1000) / 1000;
          // 去除距離小於 0.0035的點
          if (dist < 0.0035) {
            temp.splice(j, 1);
            k = temp.length;
          } else {
            j++;
          }
        }
      }
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

exports.getFitbitData = functions.database.ref('/game/{gameKey}/timeSpent').onCreate((snap, context) => {
  console.log(snap.val());

  var date = '';
  var startTime = '';
  var endTime = '';
  var path = snap._path.substring(0, snap._path.length -9);

  admin.database().ref(path).once('value', (snapshot) => {
      var event = snapshot.val();
      console.log(event);
      // 2013-03-10T02:00:00Z
      var start_time = new Date(event.startTime);
      // 2013-03-10
      date = start_time.toISOString().substring(0, 10);
      // 02:00
      startTime = start_time.toISOString().substring(11, 16);
      var end_time = new Date((event.startTime + event.timeSpent));
      // 02:00 + timeSpent
      endTime = end_time.toISOString().substring(11, 16);
      console.log(date);
      console.log(startTime);
      console.log(endTime);

      var fitbitColor = event.fitbit;
      var fitbit_access_token = '';

      if (fitbitColor === 'Blue' || fitbitColor === '藍色') {
        fitbit_access_token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2M0g0VDUiLCJhdWQiOiIyMkNTN04iLCJpc3MiOiJGaXRiaXQiLCJ0eXAiOiJhY2Nlc3NfdG9rZW4iLCJzY29wZXMiOiJ3aHIgd3BybyB3YWN0IiwiZXhwIjoxNTU4MDEyMDA4LCJpYXQiOjE1MjY0NzYwMDh9.Ro4Zc3R_Kuz-9fqKL527bm3N8ayWTdwBfDo3hoyA0aE';
      } else if (fitbitColor === 'Black' || fitbitColor === '黑色') {
        fitbit_access_token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0Q0pZRFQiLCJhdWQiOiIyMjdRTk0iLCJpc3MiOiJGaXRiaXQiLCJ0eXAiOiJhY2Nlc3NfdG9rZW4iLCJzY29wZXMiOiJ3aHIgd3BybyB3YWN0IiwiZXhwIjoxNTU4MDA0NDg4LCJpYXQiOjE1MjY0NzAzNjR9.lKWPVxROR-xxWlj9y6mU-fQPUX4Vvx6kYUnY3LQRTQY';
      }

      if (fitbit_access_token.length > 0) {
        axios.get(`https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1sec/time/${startTime}/${endTime}.json`, {
          headers: {
          'Authorization': `Bearer ${fitbit_access_token}`
        },
          })
          .then((hr) => {
            console.log(hr.data);
            console.log(hr.data['activities-heart'][0]['value']);
            return snap.ref.child(path).update({
              heartRate: (hr.data['activities-heart'][0]['value'] + 10)
            });
          })
          .catch((error) => {
            console.error(error)
          });
      }
  });
  return true;
});

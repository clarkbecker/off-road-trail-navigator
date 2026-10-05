async function testWIDNROutSR() {
  const url = `https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer/0/query?where=PROP_NAME%20LIKE%20'%25Gandy%25'&outFields=PROP_NAME&outSR=4326&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Feature count:', data.features?.length);
  if (data.features?.[0]) {
    console.log('First feature name:', data.features[0].attributes);
    console.log('First coordinate pair (should be [lng, lat]):', data.features[0].geometry?.paths?.[0]?.[0]);
  }
}
testWIDNROutSR();

async function listWIDNRTrails() {
  const url = `https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer/0/query?where=1=1&outFields=PROP_NAME,INFO_URL&returnGeometry=false&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('WI State Trails:', data.features?.map(f => f.attributes.PROP_NAME));
}
listWIDNRTrails();

async function inspectWIDNR() {
  const url = 'https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer/0?f=json';
  const res = await fetch(url);
  const data = await res.json();
  console.log('WI DNR Layer fields:', data.fields?.map(f => f.name));
}
inspectWIDNR();

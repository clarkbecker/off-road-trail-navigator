async function inspectUSFSTrails() {
  const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/2/query?where=forestname%20LIKE%20'%25Chequamegon%25'&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Sample Trail feature:', JSON.stringify(data.features?.[0]?.attributes, null, 2));
  console.log('Sample Trail geometry paths length:', data.features?.[0]?.geometry?.paths?.length);
}
inspectUSFSTrails();

async function testQueryChequamegonTrails() {
  const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/2/query?where=forestname%20LIKE%20'%25Chequamegon%25'&outFields=id,name,forestname&returnGeometry=false&returnCountOnly=true&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Chequamegon-Nicolet trail count:', data.count);
}
testQueryChequamegonTrails();

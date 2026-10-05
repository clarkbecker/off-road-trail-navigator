async function testQueryChequamegon() {
  const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1/query?where=forestname%20LIKE%20'%25Chequamegon%25'&outFields=id,name,forestname,surfacetype,atv,otherwheeled_ohv,routestatus&returnGeometry=false&returnCountOnly=true&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Chequamegon-Nicolet road count:', data.count);
}
testQueryChequamegon();

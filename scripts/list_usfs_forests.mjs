async function listForests() {
  const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1/query?where=adminorg%20LIKE%20'09%'&outFields=forestname&returnGeometry=false&returnDistinctValues=true&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Region 9 Forests:', data.features?.map(f => f.attributes.forestname));
}
listForests();

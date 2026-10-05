async function inspectUSFS() {
  const url = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer/1?f=json';
  const res = await fetch(url);
  const data = await res.json();
  console.log('Layer name:', data.name);
  console.log('Fields:', data.fields?.map(f => ({ name: f.name, type: f.type })));
}
inspectUSFS();

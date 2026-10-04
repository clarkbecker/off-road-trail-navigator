async function searchArcGIS() {
  const queries = [
    'Wisconsin ATV trails',
    'Wisconsin snowmobile trails',
    'Wisconsin ORV',
    'DNR ATV trails Wisconsin',
  ];
  for (const q of queries) {
    const url = 'https://www.arcgis.com/sharing/rest/search?q=' + encodeURIComponent(q) + '&f=json&num=10';
    const res = await fetch(url);
    const data = await res.json();
    console.log(`\nQuery "${q}": ${data.results?.length || 0} results`);
    for (const item of (data.results || [])) {
      console.log(`- [${item.type}] ${item.title} (owner: ${item.owner}) url: ${item.url || 'https://www.arcgis.com/home/item.html?id=' + item.id}`);
    }
  }
}
searchArcGIS();

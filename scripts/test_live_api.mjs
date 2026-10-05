async function testLiveApi() {
  const t0 = Date.now();
  console.log('Fetching https://off-road-trail-navigator.vercel.app/api/trails ...');
  try {
    const res = await fetch('https://off-road-trail-navigator.vercel.app/api/trails');
    const dt = Date.now() - t0;
    console.log(`Status: ${res.status} in ${dt}ms`);
    if (!res.ok) {
      const errText = await res.text();
      console.log('Error text:', errText.slice(0, 500));
      return;
    }
    const data = await res.json();
    console.log(`Returned trails count: ${data.trails?.length}`);
    const trail8 = data.trails?.filter(t => t.name?.toLowerCase().includes('trail 8'));
    console.log('Trail 8 count:', trail8?.length);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testLiveApi();

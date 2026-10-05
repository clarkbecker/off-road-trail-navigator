async function testEndpoints() {
  try {
    const dnrRes = await fetch('https://dnrmaps.wi.gov/arcgis/rest/services/PR_TRAILS/PR_STATE_TRAIL_DISS_WTM_Ext/MapServer?f=json');
    if (dnrRes.ok) {
      const dnrData = await dnrRes.json();
      console.log('WI DNR Layers:', dnrData.layers);
    } else {
      console.log('WI DNR status:', dnrRes.status);
    }
  } catch (e) {
    console.error('WI DNR error:', e.message);
  }

  try {
    const usfsRes = await fetch('https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer?f=json');
    if (usfsRes.ok) {
      const usfsData = await usfsRes.json();
      console.log('USFS MVUM Layers:', usfsData.layers);
    } else {
      console.log('USFS status:', usfsRes.status);
    }
  } catch (e) {
    console.error('USFS error:', e.message);
  }
}

testEndpoints();

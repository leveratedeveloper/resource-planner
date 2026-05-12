const baseUrl = 'http://127.0.0.1:8000/api/v1';
const token = '15|Zp6H8W5D9x8p5p5p5p5p5p5p5p5p5p5p5p5p5p5'; // Note: This is probably expired or dummy

async function test() {
  try {
    // In a real scenario, we'd need a valid token. 
    // Since I can't easily get one here, I'll just check the structure if I can.
    console.log(`Testing with base URL: ${baseUrl}`);
    
    // Check channel classifications
    const res1 = await fetch(`${baseUrl}/channel-classifications`);
    console.log(`Channel classifications status: ${res1.status}`);
    
    // Check campaigns
    const res2 = await fetch(`${baseUrl}/campaigns?include=channels`);
    console.log(`Campaigns status: ${res2.status}`);
    if (res2.status === 200) {
      const data = await res2.json();
      console.log('Campaign channels preview:', JSON.stringify(data.data?.[0]?.channels || [], null, 2));
    }
  } catch (err) {
    console.error('Test error:', err);
  }
}

test();

async function testApi() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/v1/campaigns', {
      headers: {
        'Accept': 'application/json'
      }
    });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Data:', JSON.stringify(data).substring(0, 500));
  } catch (error) {
    console.error('Error:', error);
  }
}

testApi();

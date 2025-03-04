// Simple script to test OpenAI API connectivity
import fs from 'fs';

// Read API key from .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const apiKeyMatch = envFile.match(/VITE_OPENAI_API_KEY=([^\n]*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

if (!apiKey) {
  console.error('❌ ERROR: VITE_OPENAI_API_KEY is not defined in your .env file');
  process.exit(1);
}

console.log(`API Key found: ${apiKey.substring(0, 10)}...`);
console.log('Testing API key with a simple API call...');

// Test the API key with a simple request using built-in fetch
async function testApiKey() {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS: Your API key is valid!');
      console.log('Response:', data);
    } else {
      const errorData = await response.text();
      console.error('❌ ERROR: API key validation failed!');
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorData);
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to connect to OpenAI API');
    console.error(error.message);
    console.error('This may indicate a network connectivity issue or an issue with the API itself.');
  }
}

testApiKey(); 
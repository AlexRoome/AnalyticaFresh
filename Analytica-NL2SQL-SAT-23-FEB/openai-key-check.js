// Script to validate the OpenAI API key
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Configure dotenv
const __dirname = dirname(fileURLToPath(import.meta.url));
config();

const apiKey = process.env.VITE_OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ ERROR: VITE_OPENAI_API_KEY is not defined in your .env file');
  process.exit(1);
}

console.log(`API Key found: ${apiKey.substring(0, 10)}...`);
console.log('Testing API key with a simple API call...');

// Using fetch for the API call
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

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS: Your API key is valid!');
      console.log('Sample response:', data);
    } else {
      console.error('❌ ERROR: API key validation failed!');
      console.error('Response:', data);
      console.error('This typically means your API key is invalid or has insufficient permissions.');
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to connect to OpenAI API');
    console.error(error);
    console.error('This may indicate a network connectivity issue or an issue with the API itself.');
  }
}

testApiKey(); 
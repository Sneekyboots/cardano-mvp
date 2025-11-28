import DemoWithRealCharli3 from './demoWithRealCharli3.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.CHARLI3_API_KEY;

  if (!apiKey) {
    console.error('❌ CHARLI3_API_KEY not set in .env');
    console.log('\nTo get an API key:');
    console.log('1. Go to https://charli3.io/api');
    console.log('2. Sign up (free tier available)');
    console.log('3. Copy API key to .env file\n');
    process.exit(1);
  }

  console.log('🔑 Charli3 API key loaded');
  
  const demo = new DemoWithRealCharli3(apiKey);
  await demo.runDemo();
}

main().catch(console.error);
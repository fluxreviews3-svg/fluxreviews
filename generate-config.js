import fs from 'fs';
import path from 'path';

// Self-contained .env parser to avoid requiring 'dotenv' npm package
const env = {};
try {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;
      const key = trimmed.substring(0, separatorIndex).trim();
      let value = trimmed.substring(separatorIndex + 1).trim();
      
      // Strip optional quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value;
    });
    console.log('📝 Parsed local .env file successfully.');
  } else {
    console.log('ℹ️ No local .env file found. Falling back to system environment variables.');
  }
} catch (err) {
  console.warn('⚠️ Warning: Failed to parse .env file:', err.message);
}

const getVar = (key) => env[key] || process.env[key] || '';

const configContent = `// Generated Config File - Do Not Commit or Edit Directly
export const firebaseConfig = {
  apiKey: "${getVar('FIREBASE_API_KEY')}",
  authDomain: "${getVar('FIREBASE_AUTH_DOMAIN')}",
  databaseURL: "${getVar('FIREBASE_DATABASE_URL')}",
  projectId: "${getVar('FIREBASE_PROJECT_ID')}",
  storageBucket: "${getVar('FIREBASE_STORAGE_BUCKET')}",
  messagingSenderId: "${getVar('FIREBASE_MESSAGING_SENDER_ID')}",
  appId: "${getVar('FIREBASE_APP_ID')}"
};

export const TMDB_API_KEY = "${getVar('TMDB_API_KEY')}";
`;

fs.writeFileSync('config.js', configContent);
console.log('✅ config.js generated successfully.');

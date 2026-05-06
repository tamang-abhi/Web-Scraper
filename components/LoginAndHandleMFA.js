const fs = require('fs').promises;
const path = require('path');

// Add these helpers near the top of scraper.js (you already have fs, path etc.)
const COOKIE_PATH = path.join(__dirname, '../cookies.json');
const { readFile, writeFile } = fs;

// Load cookies if available
async function loadSavedCookies(page) {
  try {
    const raw = await readFile(COOKIE_PATH, 'utf8');
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies)) return false;
    await page.setCookie(...cookies);
    console.log('🔑 Loaded saved cookies.');
    return true;
  } catch (err) {
    // file not found or parse error
    console.log('No cookies found.');
    return false;
  }
}

async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    await writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2), 'utf8');
    console.log('💾 Cookies saved to cookies.json');
  } catch (err) {
    console.warn('⚠️ Failed to save cookies:', err.message);
  }
}

// Simple console prompt for OTP (used by default)
function promptForOtp(promptText = 'Enter MFA code: ') {
  return new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question(promptText, answer => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

// Optional: fetch OTP from an email account automatically (stub + notes below)
// If you want fully automated, implement an IMAP/Gmail API reader here and return the code
// Example libraries: node-imap, imap-simple, googleapis (Gmail API).
async function fetchOtpFromEmail() {
  // <-- implement using your email provider / API
  // return the numeric code as a string, e.g. "123456"
  throw new Error('Auto OTP fetch not implemented. Enable manual entry or implement IMAP/Gmail fetch.');
}

// Main login + MFA handler. Call this instead of your old page.goto/login block.
async function loginAndHandleMFA(page, { loginurl, username, password } = {}) {

  if (!loginurl || !username || !password) {
    throw new Error('Missing loginurl, username, password');
  }

  const loginUrl = loginurl; // uses loginurl from your existing top-level const
  const usernameVal = username; // uses username from env as already declared
  const passwordVal = password;
  
  // 1. Try cookie-based login
  await loadSavedCookies(page);
  await page.goto('https://www.dealertrack.ca/default1.aspx', { waitUntil: 'networkidle2' });

  if (page.url().includes('default1.aspx')) {
    console.log('✅ Logged in using cookies (MFA skipped).');
    return;
  }

  // normal login flow
  console.log('🔐 Performing login with username/password');
  await page.goto(loginUrl, { waitUntil: 'networkidle2' });

  // fill credentials
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.type('#username', usernameVal, { delay: 50 });
  await page.type('#password', passwordVal, { delay: 50 });

  // click sign-on
  await Promise.all([
    // navigation may not always fire (MFA step). Do not fail if navigation doesn't happen.
    page.click('#signOnButton'),
    // but wait small time for page transitions
    new Promise(resolve => setTimeout(resolve, 15000))
  ]);

  // Wait for either dashboard or device selector or OTP input
  let stateHandle;
  try {
    stateHandle = await page.waitForFunction(() => {
      // dashboard URL
      if (location.href.includes('default1.aspx')) return 'dashboard';

      // device-selection tile (the element you showed)
      if (document.querySelector('[data-id="tile-selector-button-pingoneAuth"]')) return 'selectDevice';

      // direct otp input (if already on same page)
      if (document.querySelector('input[name="otp"], #passcode')) return 'enterOtp';

      // still waiting
      return '';
    }, { polling: 500, timeout: 30000 });
  } catch (err) {
    // Timeout: try a narrower check (maybe slower network). We'll try to detect presence anyway.
    console.log('⚠️ Initial post-login wait timed out - attempting fallback checks.');
  }

  // If we have a handle, get value, otherwise evaluate immediately
  let state = null;
  if (stateHandle) {
    try {
      state = await stateHandle.jsonValue();
    } catch (e) {
      // fallback
      state = await page.evaluate(() => {
        if (location.href.includes('default1.aspx')) return 'dashboard';
        if (document.querySelector('[data-id="tile-selector-button-pingoneAuth"]')) return 'selectDevice';
        if (document.querySelector('input[name="otp"], #passcode')) return 'enterOtp';
        return null;
      });
    }
  } else {
    // fallback quick evaluate
    state = await page.evaluate(() => {
      if (location.href.includes('default1.aspx')) return 'dashboard';
      if (document.querySelector('[data-id="tile-selector-button-pingoneAuth"]')) return 'selectDevice';
      if (document.querySelector('input[name="otp"], #passcode')) return 'enterOtp';
      return null;
    });
  }

  if (state === 'dashboard') {
    console.log('✅ Reached dashboard after login.');
    await saveCookies(page);
    return;
  }

  // If device selectors are shown, click the email tile
  if (state === 'selectDevice' || await page.$('[data-id="tile-selector-button-pingoneAuth"]')) {
    try {
      console.log('📨 Selecting email device to send the OTP...');
      await page.click('[data-id="tile-selector-button-pingoneAuth"]');
      // small pause for OTP input to render
      await new Promise(resolve => setTimeout(resolve, 15000));
      // wait for the otp input
      await page.waitForSelector('input[name="otp"], #passcode', { timeout: 15000 });
    } catch (err) {
      console.error('❌ Failed to click device selector or wait for OTP input:', err.message);
      throw err;
    }
  }

  // Wait for the OTP field to appear
  await page.waitForSelector('input[name="otp"], #passcode', { timeout: 30000 });
  console.log('🔢 OTP input detected. Waiting for code...');

  // Get OTP either automatically (if env set) or via prompt
  let otpCode = null;
//   if (process.env.AUTO_FETCH_OTP === 'true') {
//     try {
//       console.log('📬 Attempting to fetch OTP from email (AUTO_FETCH_OTP=true)...');
//       otpCode = await fetchOtpFromEmail();
//       console.log('📥 OTP fetched from email:', otpCode ? '[REDACTED]' : 'none');
//     } catch (err) {
//       console.warn('⚠️ Auto OTP fetch failed:', err.message);
//     }
//   }

  if (!otpCode) {
    otpCode = await promptForOtp('Enter the 6-digit MFA code you received by email: ');
  }

  // type OTP into whichever field exists
  const otpSelector = await page.$('input[name="otp"], #passcode');
  if (!otpSelector) throw new Error('OTP input not found after waiting.');

  // focus & type
  await otpSelector.focus();
  await page.keyboard.type(otpCode, { delay: 80 });

  // Wait until sign-on button becomes enabled, then click
  try {
    await page.waitForFunction(() => {
      const btn = document.querySelector('#sign-on');
      return !!btn && !btn.disabled && !btn.classList.contains('button--disabled');
    }, { timeout: 15000 });

    await page.click('#sign-on');

  } catch (err) {
    // If the button never enabled, still try to click it (some pages toggle classes only)
    console.warn('⚠️ Sign-on button did not become enabled via wait. Attempting click anyway...');
    const maybeBtn = await page.$('#sign-on');
    if (maybeBtn) await maybeBtn.click();
  }

  // finally wait for dashboard
  try {
    await page.waitForFunction(() => location.href.includes('default1.aspx'), { timeout: 30000 });
    console.log('✅ Successfully reached dashboard after MFA.');
    await saveCookies(page);
    return;
  } catch (err) {
    throw new Error('Failed to reach dashboard after submitting OTP. ' + err.message);
  }
}

module.exports = { loginAndHandleMFA };
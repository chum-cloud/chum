/**
 * CHUM Browser Bridge
 * Runs on VPS with headless Chrome. Polls Supabase for pending tweet tasks,
 * executes them via browser automation (post, reply, read mentions, search).
 * 
 * Usage: SUPABASE_URL=... SUPABASE_KEY=... node bridge.js
 */

const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://akkhgcmmgzrianbdfijt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_6vkTlLd3lRSMLPvfaq571g_8XRSdu4W';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium-browser';
const USER_DATA_DIR = process.env.USER_DATA_DIR || '/root/chromium-profile';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000'); // 1 min
const MAX_TWEETS_PER_HOUR = parseInt(process.env.MAX_TWEETS_PER_HOUR || '5');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let browser = null;
let tweetsThisHour = 0;
let hourStart = Date.now();

// ─── Browser Management ───

async function launchBrowser() {
  if (browser) return browser;
  
  // Clean stale lock file to prevent "Failed to create SingletonLock" errors
  const fs = require('fs');
  const lockPath = `${USER_DATA_DIR}/SingletonLock`;
  try { fs.unlinkSync(lockPath); } catch { /* doesn't exist, fine */ }
  
  console.log('[bridge] Launching Chrome...');
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-features=VizDisplayCompositor',
    ],
  });
  console.log('[bridge] Chrome ready');
  return browser;
}

async function getPage() {
  const b = await launchBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  return page;
}

// ─── Rate Limiting ───

function checkRateLimit() {
  if (Date.now() - hourStart > 3600000) {
    tweetsThisHour = 0;
    hourStart = Date.now();
  }
  return tweetsThisHour < MAX_TWEETS_PER_HOUR;
}

// ─── Tweet Actions ───

async function postTweet(page, content) {
  console.log(`[bridge] Posting tweet: "${content.substring(0, 50)}..."`);
  
  await page.goto('https://x.com/compose/post', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(5000);

  // Debug: screenshot if selector not found quickly
  let editor;
  try {
    editor = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
  } catch (e) {
    // Try alternate: the contenteditable div
    console.log('[bridge] Primary selector failed, trying alternate...');
    await page.screenshot({ path: '/root/chum-bridge/debug-compose.png' });
    editor = await page.waitForSelector('div[contenteditable="true"][role="textbox"]', { timeout: 10000 });
  }
  await editor.click();
  await sleep(500);
  
  // Type character by character to avoid detection
  for (const char of content) {
    await page.keyboard.type(char, { delay: 20 + Math.random() * 30 });
  }
  await sleep(1000);

  // Use Ctrl+Enter to post (most reliable method — avoids selector issues with Post button)
  console.log('[bridge] Submitting tweet via Ctrl+Enter...');
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
  await sleep(5000);
  
  // Take post-submit screenshot
  await page.screenshot({ path: '/root/chum-bridge/debug-post-submit.png' });
  
  const finalUrl = page.url();
  tweetsThisHour++;
  console.log(`[bridge] Post complete. Final URL: ${finalUrl}`);
  
  return { success: true, url: finalUrl, postedAt: new Date().toISOString() };
}

async function replyToTweet(page, replyToUrl, content) {
  console.log(`[bridge] Replying to: ${replyToUrl}`);
  
  await page.goto(replyToUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  // Click the reply box directly on the tweet page
  const editor = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
  await editor.click();
  await sleep(500);
  
  for (const char of content) {
    await page.keyboard.type(char, { delay: 20 + Math.random() * 30 });
  }
  await sleep(1000);

  // Submit via Ctrl+Enter
  console.log('[bridge] Submitting reply via Ctrl+Enter...');
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
  await sleep(4000);

  tweetsThisHour++;
  return { success: true, repliedTo: replyToUrl, postedAt: new Date().toISOString() };
}

/**
 * Browse CT feed — scroll "For You" timeline and scrape posts
 */
async function browseFeed(page) {
  console.log('[bridge] Browsing CT feed...');
  
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  
  // Scroll down a few times to load more tweets
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(1500);
  }
  
  const posts = await page.evaluate(() => {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    return Array.from(tweets).slice(0, 20).map(tweet => {
      const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const authorEl = tweet.querySelector('[data-testid="User-Name"]');
      const author = authorEl?.textContent || '';
      // Extract handle from author text (e.g. "Username@handle·2h")
      const handleMatch = author.match(/@(\w+)/);
      const handle = handleMatch ? handleMatch[1] : '';
      const links = tweet.querySelectorAll('a[href*="/status/"]');
      const link = links.length > 0 ? links[links.length - 1]?.href || '' : '';
      const time = tweet.querySelector('time')?.dateTime || '';
      const likes = tweet.querySelector('[data-testid="like"]')?.textContent || '0';
      const retweets = tweet.querySelector('[data-testid="retweet"]')?.textContent || '0';
      const isRetweet = !!tweet.querySelector('[data-testid="socialContext"]');
      return { text, author: handle, link, time, likes, retweets, isRetweet };
    }).filter(t => t.text.length > 10 && t.link);
  });

  console.log(`[bridge] Found ${posts.length} posts on CT feed`);
  return { success: true, posts, count: posts.length, scrapedAt: new Date().toISOString() };
}

async function readMentions(page) {
  console.log('[bridge] Reading mentions...');
  
  await page.goto('https://x.com/notifications/mentions', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const mentions = await page.evaluate(() => {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    return Array.from(tweets).slice(0, 10).map(tweet => {
      const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const author = tweet.querySelector('[data-testid="User-Name"]')?.textContent || '';
      const link = tweet.querySelector('a[href*="/status/"]')?.href || '';
      const time = tweet.querySelector('time')?.dateTime || '';
      return { text, author, link, time };
    });
  });

  return { success: true, mentions, count: mentions.length, scrapedAt: new Date().toISOString() };
}

async function searchTweets(page, query) {
  console.log(`[bridge] Searching: "${query}"`);
  
  const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const results = await page.evaluate(() => {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    return Array.from(tweets).slice(0, 15).map(tweet => {
      const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const author = tweet.querySelector('[data-testid="User-Name"]')?.textContent || '';
      const link = tweet.querySelector('a[href*="/status/"]')?.href || '';
      const time = tweet.querySelector('time')?.dateTime || '';
      const likes = tweet.querySelector('[data-testid="like"]')?.textContent || '0';
      return { text, author, link, time, likes };
    });
  });

  return { success: true, results, query, count: results.length, scrapedAt: new Date().toISOString() };
}

async function readTimeline(page, username) {
  console.log(`[bridge] Reading timeline: @${username}`);
  
  await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  const tweets = await page.evaluate(() => {
    const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
    return Array.from(tweetEls).slice(0, 10).map(tweet => {
      const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const link = tweet.querySelector('a[href*="/status/"]')?.href || '';
      const time = tweet.querySelector('time')?.dateTime || '';
      return { text, link, time };
    });
  });

  return { success: true, tweets, username, count: tweets.length, scrapedAt: new Date().toISOString() };
}

// ─── Task Processing ───

async function processTask(task) {
  const page = await getPage();
  
  try {
    let result;
    
    switch (task.action) {
      case 'post':
        if (!checkRateLimit()) {
          return { success: false, error: 'Rate limit: max tweets/hour reached' };
        }
        result = await postTweet(page, task.content);
        break;
        
      case 'reply':
        if (!checkRateLimit()) {
          return { success: false, error: 'Rate limit: max tweets/hour reached' };
        }
        result = await replyToTweet(page, task.reply_to_url, task.content);
        break;
        
      case 'read_mentions':
        result = await readMentions(page);
        break;
        
      case 'search':
        result = await searchTweets(page, task.search_query || '$CHUM');
        break;
        
      case 'read_timeline':
        result = await readTimeline(page, task.search_query || 'chum_cloud');
        break;

      case 'browse_feed':
        result = await browseFeed(page);
        break;
        
      default:
        result = { success: false, error: `Unknown action: ${task.action}` };
    }
    
    return result;
  } catch (err) {
    console.error(`[bridge] Task ${task.id} failed:`, err.message);
    return { success: false, error: err.message };
  } finally {
    await page.close().catch(() => {});
  }
}

// ─── Main Loop ───

async function pollAndProcess() {
  try {
    // Fetch pending tasks
    const { data: tasks, error } = await supabase
      .from('pending_tweets')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(3);

    if (error) {
      console.error('[bridge] Supabase error:', error.message);
      return;
    }

    if (!tasks || tasks.length === 0) return;

    console.log(`[bridge] Processing ${tasks.length} task(s)...`);

    for (const task of tasks) {
      // Mark as processing
      await supabase
        .from('pending_tweets')
        .update({ status: 'processing' })
        .eq('id', task.id);

      const result = await processTask(task);

      // Update with result
      await supabase
        .from('pending_tweets')
        .update({
          status: result.success ? 'done' : 'failed',
          result: result,
          error: result.error || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      console.log(`[bridge] Task ${task.id} (${task.action}): ${result.success ? 'done' : 'FAILED'}`);
      
      // Wait between tasks to be human-like
      await sleep(3000 + Math.random() * 5000);
    }
  } catch (err) {
    console.error('[bridge] Poll error:', err.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('[bridge] CHUM Browser Bridge starting...');
  console.log(`[bridge] Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`[bridge] Max tweets/hour: ${MAX_TWEETS_PER_HOUR}`);
  
  // Pre-launch browser
  await launchBrowser();
  
  // Verify X login
  const page = await getPage();
  console.log('[bridge] Navigating to x.com...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const title = await page.title();
  const url = page.url();
  console.log(`[bridge] Page loaded: ${url} — "${title}"`);
  await page.close();
  
  if (url.includes('/login') || url.includes('/i/flow')) {
    console.error(`[bridge] ERROR: Not logged into X! URL: ${url}, Title: ${title}`);
    console.error('[bridge] Run noVNC to log in: http://152.42.196.207:6080/vnc.html');
    process.exit(1);
  }
  
  console.log(`[bridge] X login verified! Page: ${title}`);
  console.log('[bridge] Starting poll loop...');
  
  // Poll loop
  while (true) {
    await pollAndProcess();
    await sleep(POLL_INTERVAL);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[bridge] Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[bridge] Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});

main().catch(err => {
  console.error('[bridge] Fatal:', err);
  process.exit(1);
});

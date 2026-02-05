import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const v1 = client.v1;

async function main() {
  // Update profile image (PFP)
  console.log('🎭 Updating PFP...');
  try {
    const pfpData = fs.readFileSync('/Users/makoto/documents/chum/frontend/public/twitter-pfp.png');
    const pfpBase64 = pfpData.toString('base64');
    await v1.updateAccountProfileImage(pfpBase64);
    console.log('  ✅ PFP updated!');
  } catch (e) {
    console.log('  ❌ PFP error:', e.message || e);
  }

  // Update banner
  console.log('🎬 Updating banner...');
  try {
    const bannerData = fs.readFileSync('/Users/makoto/documents/chum/frontend/public/twitter-banner.png');
    const bannerBase64 = bannerData.toString('base64');
    await v1.updateAccountProfileBanner(bannerBase64);
    console.log('  ✅ Banner updated!');
  } catch (e) {
    console.log('  ❌ Banner error:', e.message || e);
  }

  console.log('\n✅ Done!');
}

main().catch(e => console.error('Fatal:', e));

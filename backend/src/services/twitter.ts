import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';

const client = new TwitterApi({
  appKey: config.twitterApiKey,
  appSecret: config.twitterApiSecret,
  accessToken: config.twitterAccessToken,
  accessSecret: config.twitterAccessSecret,
});

const rwClient = client.readWrite;

export async function postTweet(text: string): Promise<string> {
  const { data } = await rwClient.v2.tweet(text);
  console.log(`[TWITTER] Posted tweet ${data.id}: ${text.slice(0, 60)}...`);
  return data.id;
}

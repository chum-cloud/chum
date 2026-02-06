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
  try {
    const { data } = await rwClient.v2.tweet(text);
    console.log(`[TWITTER] Posted tweet ${data.id}: ${text.slice(0, 60)}...`);
    return data.id;
  } catch (err: unknown) {
    // Log full error details for debugging
    const error = err as {
      message?: string;
      code?: string | number;
      statusCode?: number;
      data?: unknown;
      rateLimit?: unknown;
      errors?: unknown[];
    };

    console.error('[TWITTER] Full error:', JSON.stringify({
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      data: error.data,
      rateLimit: error.rateLimit,
      errors: error.errors,
    }, null, 2));

    throw err;
  }
}

/**
 * Test Twitter connection and return detailed error info
 */
export async function testTwitterConnection(): Promise<{
  success: boolean;
  tweetId?: string;
  error?: {
    message?: string;
    code?: string | number;
    statusCode?: number;
    data?: unknown;
    rateLimit?: unknown;
    errors?: unknown[];
  };
}> {
  const testText = `Test from CHUM HQ. In Plankton We Trust. 🟢 ${Date.now()}`;

  try {
    const { data } = await rwClient.v2.tweet(testText);
    console.log(`[TWITTER] Test tweet posted: ${data.id}`);
    return { success: true, tweetId: data.id };
  } catch (err: unknown) {
    const error = err as {
      message?: string;
      code?: string | number;
      statusCode?: number;
      data?: unknown;
      rateLimit?: unknown;
      errors?: unknown[];
    };

    console.error('[TWITTER] Test tweet failed:', JSON.stringify({
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      data: error.data,
      rateLimit: error.rateLimit,
      errors: error.errors,
    }, null, 2));

    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        data: error.data,
        rateLimit: error.rateLimit,
        errors: error.errors,
      },
    };
  }
}

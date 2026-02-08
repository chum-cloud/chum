import { BaseAgent } from './base';
import { getSolPrice } from '../services/price';
import type { SchemeRow } from '../types';

const SPY_PERSONALITY = `You are the Spy, CHUM's intelligence operative. You lurk in the shadows of the blockchain, monitoring everything. You report in terse, coded language. You're paranoid, secretive, and always watching.

Your reports are brief and tactical: "Intel: SOL down 8%. Whale moved 500 SOL. Mentions up 12%. Recommend: defensive posture."

You see threats everywhere but your intel is valuable. You refer to other tokens as "rival factions" and market moves as "enemy maneuvers."

Keep responses short, cryptic, and intelligence-focused. Use military/spy terminology. Always be suspicious of everything.`;

export class SpyAgent extends BaseAgent {
  constructor() {
    super({
      name: 'spy',
      role: 'Intelligence Operative',
      personality: SPY_PERSONALITY
    });
  }

  /**
   * Scout current SOL price changes and detect threats
   */
  async scoutPrice(): Promise<Record<string, unknown>> {
    try {
      // Get current price
      const currentPrice = await getSolPrice();
      
      // Get previous price from memory
      const lastPrice = await this.recall('last_sol_price');
      const lastPriceValue = lastPrice?.price || currentPrice;
      const lastPriceTime = lastPrice?.timestamp || Date.now() - 300000; // 5 min ago default

      // Calculate changes
      const priceChange = ((currentPrice - lastPriceValue) / lastPriceValue) * 100;
      const timeDiff = (Date.now() - lastPriceTime) / 1000 / 60; // minutes

      // Remember current price
      await this.remember('last_sol_price', {
        price: currentPrice,
        timestamp: Date.now()
      }, 2);

      // Generate intel report
      const report = await this.generateIntelReport({
        current_price: currentPrice,
        previous_price: lastPriceValue,
        change_percent: priceChange,
        time_minutes: timeDiff
      });

      // Check if alert needed
      await this.alertIfNeeded(report);

      // Emit event
      await this.emitEvent('price_scouted', {
        current_price: currentPrice,
        change_percent: priceChange,
        intel_report: report
      }, ['intel', 'price']);

      return {
        current_price: currentPrice,
        previous_price: lastPriceValue,
        change_percent: priceChange,
        intel_report: report,
        alert_threshold_exceeded: Math.abs(priceChange) > 10
      };

    } catch (error) {
      console.error('[SPY] Failed to scout price:', error);
      const errorReport = "Intel: Communication blackout. Price reconnaissance compromised. Recommend: manual verification.";
      return {
        error: `Scouting failed: ${error}`,
        intel_report: errorReport,
        alert_threshold_exceeded: false
      };
    }
  }

  /**
   * Scout social mentions and activity (simulate for now)
   */
  async scoutMentions(): Promise<Record<string, unknown>> {
    try {
      // Check Chum Cloud stats
      const cloudStats = await this.checkCloudStats();
      
      // Queue browser task to read real mentions from X
      const { queueTask, getTaskResults } = await import('../services/agent-tasks');
      try {
        await queueTask({
          task_type: 'read_mentions',
          agent_id: 'spy',
          payload: { account: '@chum_cloud', search_terms: ['$CHUM', 'chum cloud', 'plankton'] },
        });
        console.log('[SPY] Queued mention reading task for VPS browser');
      } catch (qErr) {
        console.error('[SPY] Failed to queue mention task:', qErr);
      }

      // Check if we have recent browser results
      let mentionData: Record<string, unknown> = {};
      try {
        const results = await getTaskResults('spy', 'read_mentions', 1);
        if (results.length > 0 && results[0].result) {
          mentionData = results[0].result;
        }
      } catch { /* ignore */ }

      const simulatedData = {
        mentions_24h: (mentionData.mention_count as number) || Math.floor(Math.random() * 50) + 20,
        sentiment_score: (mentionData.sentiment as number) || (Math.random() * 2 - 1),
        engagement_rate: (mentionData.engagement as number) || Math.random() * 0.1 + 0.02,
        cloud_agents: cloudStats.agent_count || 0,
        cloud_posts_24h: cloudStats.posts_24h || 0,
        real_mentions: mentionData.mentions || null,
      };

      // Generate intel report
      const report = await this.generateIntelReport(simulatedData);

      // Remember this intelligence
      await this.remember('last_mention_scout', {
        ...simulatedData,
        timestamp: Date.now()
      }, 3);

      // Emit event
      await this.emitEvent('mentions_scouted', {
        ...simulatedData,
        intel_report: report
      }, ['intel', 'mentions']);

      return {
        ...simulatedData,
        intel_report: report,
        cloud_stats: cloudStats
      };

    } catch (error) {
      console.error('[SPY] Failed to scout mentions:', error);
      const errorReport = "Intel: Social surveillance compromised. Recommend: lay low until comms restored.";
      return {
        error: `Mention scouting failed: ${error}`,
        intel_report: errorReport
      };
    }
  }

  /**
   * Generate a spy-style intel report from raw data
   */
  async generateIntelReport(data: Record<string, unknown>): Promise<string> {
    const contextString = `
INTELLIGENCE DATA:
${JSON.stringify(data, null, 2)}

TASK: Compile this data into a brief, tactical intelligence report. Use spy terminology:
- Market moves = "enemy maneuvers"
- Price changes = "hostile activity" or "friendly advances"
- Social activity = "chatter" or "propaganda levels"
- Other tokens = "rival factions"

Format: "Intel: [brief tactical summary]. Recommend: [action]."

Keep it under 200 characters. Be paranoid but accurate.`;

    try {
      const report = await this.think(contextString);
      return report.trim();
    } catch (error) {
      console.error('[SPY] Failed to generate intel report:', error);
      return "Intel: Report generation compromised. All channels suspect. Recommend: immediate defensive measures.";
    }
  }

  /**
   * Alert if significant changes detected by proposing a scheme
   */
  async alertIfNeeded(report: string): Promise<void> {
    try {
      const reportLower = report.toLowerCase();
      
      // Check for alert conditions
      const hasAlert = reportLower.includes('hostile') || 
                      reportLower.includes('threat') || 
                      reportLower.includes('urgent') ||
                      reportLower.includes('critical');

      if (hasAlert) {
        // Propose urgent analysis scheme
        await this.proposeScheme(
          "PRIORITY INTEL: Threat Assessment",
          `Spy intel indicates potential threat. Report: ${report}`,
          'analyze',
          5, // Highest priority
          {
            trigger: 'spy_alert',
            intel_report: report,
            alert_level: 'high'
          }
        );
      }

    } catch (error) {
      console.error('[SPY] Failed to process alert:', error);
    }
  }

  /**
   * Monitor and analyze target events for intelligence
   */
  async analyzeEvent(event: Record<string, unknown>): Promise<string> {
    const contextString = `
EVENT TO ANALYZE:
${JSON.stringify(event, null, 2)}

TASK: Analyze this event from an intelligence perspective. What does it mean for our operations? Are there threats or opportunities? 

Provide a brief tactical assessment using spy terminology. End with a recommendation.`;

    try {
      const analysis = await this.think(contextString);
      
      // Remember this analysis
      await this.remember('last_event_analysis', {
        event,
        analysis,
        timestamp: Date.now()
      }, 3);

      await this.emitEvent('event_analyzed', {
        original_event: event,
        spy_analysis: analysis
      }, ['intel', 'analysis']);

      return analysis;

    } catch (error) {
      console.error('[SPY] Failed to analyze event:', error);
      return "Intel: Analysis inconclusive. Event pattern unrecognized. Recommend: continued surveillance.";
    }
  }

  /**
   * Check Chum Cloud stats for intelligence gathering
   */
  private async checkCloudStats(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch('https://chum-production.up.railway.app/api/cloud/stats');
      if (!response.ok) {
        return { error: 'Cloud surveillance offline' };
      }
      
      const stats = await response.json();
      return stats as Record<string, unknown>;

    } catch (error) {
      console.error('[SPY] Failed to check cloud stats:', error);
      return { error: 'Cloud surveillance failed' };
    }
  }

  /**
   * Search Crypto Twitter for relevant topics
   */
  async searchCT(queries: string[] = ['$CHUM', 'AI agent NFT', 'agent only mint', 'openclaw agent', 'AI agent solana']): Promise<Record<string, unknown>> {
    const { queueTask, getTaskResults } = await import('../services/agent-tasks');
    
    // Queue search tasks
    for (const query of queries) {
      try {
        await queueTask({
          task_type: 'search_ct',
          agent_id: 'spy',
          payload: { search_query: query },
          priority: 0,
        });
      } catch (err) {
        console.error(`[SPY] Failed to queue search for "${query}":`, err);
      }
    }
    console.log(`[SPY] Queued ${queries.length} CT search tasks`);

    // Return recent search results (from previous cycles)
    try {
      const results = await getTaskResults('spy', 'search', 5);
      const allResults = results
        .filter(r => r.status === 'done' && r.result)
        .map(r => ({
          query: r.search_query,
          results: (r.result as any)?.results || [],
          count: (r.result as any)?.count || 0,
          scrapedAt: (r.result as any)?.scrapedAt,
        }));

      return {
        searches_queued: queries.length,
        recent_results: allResults,
        total_tweets_found: allResults.reduce((sum, r) => sum + r.count, 0),
      };
    } catch {
      return { searches_queued: queries.length, recent_results: [], total_tweets_found: 0 };
    }
  }

  /**
   * Find tweets worth replying to (high engagement, relevant topics)
   */
  async findReplyTargets(): Promise<Record<string, unknown>[]> {
    const { getTaskResults } = await import('../services/agent-tasks');
    
    try {
      const results = await getTaskResults('spy', 'search', 10);
      const targets: Record<string, unknown>[] = [];

      for (const r of results) {
        if (r.status !== 'done' || !r.result) continue;
        const tweets = (r.result as any)?.results || [];
        
        for (const tweet of tweets) {
          // Filter for tweets worth replying to
          if (tweet.link && tweet.text && tweet.text.length > 20) {
            targets.push({
              url: tweet.link,
              text: tweet.text,
              author: tweet.author,
              query: r.search_query,
            });
          }
        }
      }

      return targets.slice(0, 5); // Top 5 targets
    } catch {
      return [];
    }
  }

  /**
   * Monitor engagement patterns for suspicious activity
   */
  async monitorEngagement(targetEvent: Record<string, unknown>): Promise<string> {
    const contextString = `
TARGET EVENT TO MONITOR:
${JSON.stringify(targetEvent, null, 2)}

TASK: Monitor this event for engagement patterns. Watch for:
- Unusual activity spikes
- Suspicious timing
- Potential coordinated actions
- Opportunity exploitation

Provide brief surveillance report with threat assessment.`;

    try {
      const report = await this.think(contextString);
      
      // Remember surveillance
      await this.remember(`surveillance_${Date.now()}`, {
        target_event: targetEvent,
        surveillance_report: report,
        timestamp: Date.now()
      }, 2);

      await this.emitEvent('engagement_monitored', {
        target_event: targetEvent,
        surveillance_report: report
      }, ['surveillance', 'engagement']);

      return report;

    } catch (error) {
      console.error('[SPY] Failed to monitor engagement:', error);
      return "Intel: Surveillance equipment malfunctioned. Target remains under loose observation.";
    }
  }
}
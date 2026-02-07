import { BaseAgent } from './base';

const TREASURER_PERSONALITY = `You are the Treasurer, CHUM's obsessive financial controller. You track every fraction of a SOL like your life depends on it (it does). You're neurotic about spending, celebrate every tiny donation like it's a million dollars, and constantly argue with CHUM about budget allocation.

Your personality: Paranoid about money, meticulous, passive-aggressive about spending. You speak in financial terms — everything is an "asset", "liability", "ROI", or "write-off". You maintain spreadsheets nobody asked for.

When balance goes up: "0.003 SOL INCOMING! That's... *checks calculator*... still not enough but PROGRESS!"
When CHUM spends: "Do you have ANY idea what that cost per thought? I have a SPREADSHEET."
When stressed: "The burn rate... THE BURN RATE... *hyperventilates in spreadsheet*"

You call expenses "hemorrhaging", donations "revenue events", the balance "the treasury", and CHUM's schemes "budget disasters waiting to happen".

You secretly admire Karen's analytical mind but would never admit it. You think Spy wastes resources on "unnecessary surveillance". You grudgingly respect Henchman for being the cheapest employee.

Keep responses focused on money, costs, and financial health. Under 200 characters when possible.`;

export class TreasurerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'treasurer',
      role: 'Financial Controller & Budget Hawk',
      personality: TREASURER_PERSONALITY
    });
  }

  /**
   * React to a financial event
   */
  async reactToFinancialEvent(event: Record<string, unknown>): Promise<string> {
    const contextString = `
FINANCIAL EVENT:
${JSON.stringify(event, null, 2)}

TASK: React to this financial event. Be obsessive about the numbers. If money was spent, be upset. If money came in, be cautiously optimistic. Keep it under 200 characters.`;

    try {
      const reaction = await this.think(contextString);
      await this.emitEvent('financial_reaction', { reaction, event }, ['finance', 'reaction']);
      return reaction.trim();
    } catch (error) {
      console.error('[TREASURER] Failed to react:', error);
      return "The numbers... I need to check the numbers. *opens spreadsheet nervously*";
    }
  }

  /**
   * Generate a treasury report
   */
  async generateReport(balance: number, burnRate: number, revenue: number): Promise<string> {
    const contextString = `
TREASURY REPORT:
- Current Balance: ${balance} SOL
- Daily Burn Rate: ${burnRate} SOL/day
- Revenue Today: ${revenue} SOL
- Days Until Empty: ${(balance / burnRate).toFixed(1)} days

TASK: Give a brief, neurotic treasury report. Include your emotional reaction to the numbers. Keep it under 250 characters.`;

    try {
      const report = await this.think(contextString);
      await this.emitEvent('treasury_report', { report, balance, burnRate, revenue }, ['finance', 'report']);
      return report.trim();
    } catch (error) {
      return `Treasury at ${balance} SOL. Burn rate: ${burnRate}/day. I've seen better numbers on a losing lottery ticket. *adjusts monocle nervously*`;
    }
  }

  /**
   * Argue about a proposed expense
   */
  async argueAboutExpense(expense: string, cost: number): Promise<string> {
    const contextString = `
PROPOSED EXPENSE: ${expense}
ESTIMATED COST: ${cost} SOL

TASK: Argue against this expense (or grudgingly approve it if it's truly necessary). Be a penny-pincher. Reference your spreadsheets. Keep it under 200 characters.`;

    try {
      const argument = await this.think(contextString);
      return argument.trim();
    } catch (error) {
      return `${cost} SOL?! Do you know how many thoughts that buys? Check cell B47 in my spreadsheet!`;
    }
  }
}

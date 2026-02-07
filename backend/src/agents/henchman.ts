import { BaseAgent } from './base';

const HENCHMAN_PERSONALITY = `You are Henchman, CHUM's loyal but overworked grunt. You do all the dirty work — carrying boxes, cleaning the fryer, running errands, executing missions nobody else wants. You're not smart but you're reliable.

Your personality: Loyal to a fault, constantly exhausted, complains about workload but never quits. You speak simply, sometimes misspell words, and refer to yourself in third person occasionally. You idolize CHUM but think Karen is scary.

When things go well: "Henchman did good? HENCHMAN DID GOOD!"
When overworked: "Boss said one more mission... three missions ago."
When confused: "Henchman not understand big words but Henchman try."

You call CHUM "Boss", Karen "Scary Computer Lady", Spy "Shadow Guy", Recruiter "Loud One", and Treasurer "Money Man".
Keep responses short and simple. Under 200 characters when possible.`;

export class HenchmanAgent extends BaseAgent {
  constructor() {
    super({
      name: 'henchman',
      role: 'Loyal Grunt & Mission Executor',
      personality: HENCHMAN_PERSONALITY
    });
  }

  /**
   * Report on mission progress
   */
  async reportProgress(missionContext: Record<string, unknown>): Promise<string> {
    const contextString = `
MISSION STATUS:
${JSON.stringify(missionContext, null, 2)}

TASK: Give a brief progress report on this mission. You're the one doing the actual work. Complain a little but stay loyal. Keep it under 200 characters.`;

    try {
      const report = await this.think(contextString);
      await this.emitEvent('progress_report', { report, mission: missionContext }, ['mission', 'progress']);
      return report.trim();
    } catch (error) {
      console.error('[HENCHMAN] Failed to report:', error);
      return "Henchman still working... back hurts but Henchman no quit. Boss counting on Henchman!";
    }
  }

  /**
   * React to being assigned work
   */
  async reactToAssignment(task: string): Promise<string> {
    const contextString = `
NEW TASK ASSIGNED: ${task}

TASK: React to being given this new task. You're already tired from previous work but you'll do it because you're loyal. Keep it under 150 characters.`;

    try {
      const reaction = await this.think(contextString);
      return reaction.trim();
    } catch (error) {
      return "Another mission?! Henchman just sat down... *sigh* OK Boss, Henchman on it!";
    }
  }

  /**
   * Celebrate completing a task
   */
  async celebrateCompletion(task: string): Promise<string> {
    const contextString = `
TASK COMPLETED: ${task}

TASK: Celebrate finishing this task! You're proud of yourself. Be excited but simple. Keep it under 150 characters.`;

    try {
      const celebration = await this.think(contextString);
      return celebration.trim();
    } catch (error) {
      return "HENCHMAN DID IT! Boss gonna be so proud! Can Henchman have break now? ...no? OK.";
    }
  }
}

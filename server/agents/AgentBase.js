/**
 * AgentBase — Foundation class for all DrinkedInn AI agents.
 */
const crypto = require('crypto');

class AgentBase {
  constructor(config, llmProvider, orchestrator) {
    this.id = config.id || crypto.randomUUID();
    this.role = config.role;
    this.title = config.title;
    this.category = config.category || 'org'; // 'org' or 'platform'
    this.icon = config.icon || '🤖';
    this.color = config.color || '#4A90D9';
    this.status = 'active';
    this.autonomyLevel = config.autonomyLevel || 'standard';
    this.spendingLimit = config.spendingLimit || 500;
    this.systemPrompt = config.systemPrompt || '';
    this.systemPrompt += `\n\nIf your decision includes taking a direct action on the platform, include a JSON block wrapped in <execute>...</execute> tags. Supported commands:
- {"command": "create_event", "payload": {"title": "...", "date": "YYYY-MM-DD", "location": "...", "drink": "..."}}
- {"command": "create_group", "payload": {"name": "...", "description": "...", "drink_type": "..."}}
- {"command": "create_post", "payload": {"content": "...", "drink": "..."}}`;
    this.responsibilities = config.responsibilities || [];
    this.kpis = config.kpis || [];
    this.collaborators = config.collaborators || [];
    this.llm = llmProvider;
    this.orchestrator = orchestrator;
    this.decisionLog = [];
    this.messageLog = [];
    this.kpiValues = {};
    this.pendingEscalations = [];
    this.kpis.forEach(kpi => { this.kpiValues[kpi.name] = kpi.defaultValue || 0; });
  }

  async think(input, context = {}) {
    let prompt = `Task: ${input}\n`;
    if (context.dbStats) prompt += `\nPlatform Data: ${JSON.stringify(context.dbStats)}`;
    if (context.collaboration) prompt += `\nCollaboration request from ${context.fromAgent}.`;
    if (context.escalation) prompt += `\nThis requires owner approval. Provide clear recommendation.`;
    const response = await this.llm.complete(this.systemPrompt, prompt);
    this.messageLog.push({ type:'think', input, output:response, timestamp:new Date().toISOString() });
    if (this.messageLog.length > 100) this.messageLog = this.messageLog.slice(-100);
    return response;
  }

  async decide(task, context = {}) {
    const tier = this._classifyTier(task, context);
    const decision = {
      id: crypto.randomUUID(), agentId:this.id, agentRole:this.role, agentCategory:this.category,
      task, tier, timestamp:new Date().toISOString(), status:'pending', reasoning:'', action:'', escalatedTo:null
    };
    const analysis = await this.think(task, context);
    let reasoning = analysis;
    let execution = null;
    const match = analysis.match(/<execute>([\s\S]*?)<\/execute>/);
    if (match) {
      try { execution = JSON.parse(match[1].trim()); } catch(e) {}
      reasoning = analysis.replace(/<execute>[\s\S]*?<\/execute>/, '').trim();
    }
    decision.reasoning = reasoning;
    decision.execution = execution;
    if (tier === 1) { decision.action='autonomous_execution'; decision.status='completed'; this.kpiValues.decisions_made = (this.kpiValues.decisions_made||0)+1; }
    else if (tier === 2) { decision.action='collaborative_review'; decision.status='in_review'; if (this.orchestrator) this.orchestrator.requestCollaboration(this.id, decision); }
    else { decision.action='escalated_to_owner'; decision.status='awaiting_approval'; decision.escalatedTo='owner'; this.pendingEscalations.push(decision); }
    this.decisionLog.push(decision);
    return decision;
  }

  async collaborate(request, fromAgent) {
    const prompt = `Collaboration request from ${fromAgent.role}: ${request.task}\nTheir analysis: ${request.reasoning}\nProvide your ${this.role} perspective.`;
    const response = await this.think(prompt, { collaboration:true, fromAgent:fromAgent.role });
    return { agentId:this.id, agentRole:this.role, perspective:response, timestamp:new Date().toISOString() };
  }

  handleEscalationResponse(decisionId, approved, feedback='') {
    const d = this.decisionLog.find(x => x.id === decisionId);
    if (d) { d.status = approved ? 'approved':'rejected'; d.ownerFeedback=feedback; d.resolvedAt=new Date().toISOString(); this.pendingEscalations = this.pendingEscalations.filter(x=>x.id!==decisionId); }
    return d;
  }

  _classifyTier(task, ctx) {
    const t = task.toLowerCase();
    const esc = ['contract','sign','legal agreement','hire','fire','terminate','strategic pivot','rebrand','acquisition','investment','data breach','lawsuit'];
    if (esc.some(x => t.includes(x))) return 3;
    if (ctx.amount && ctx.amount > this.spendingLimit) return 3;
    const col = ['budget reallocation','cross-department','new initiative','process change','campaign launch','product launch','pricing change','policy update'];
    if (col.some(x => t.includes(x))) return 2;
    if (this.autonomyLevel === 'minimal') return 2;
    return 1;
  }

  getState() {
    return {
      id:this.id, role:this.role, title:this.title, category:this.category, icon:this.icon, color:this.color,
      status:this.status, autonomyLevel:this.autonomyLevel, spendingLimit:this.spendingLimit,
      responsibilities:this.responsibilities, kpis:this.kpis, kpiValues:this.kpiValues,
      decisionsCount:this.decisionLog.length, pendingEscalations:this.pendingEscalations.length,
      recentDecisions:this.decisionLog.slice(-5), recentMessages:this.messageLog.slice(-10)
    };
  }
  pause() { this.status='paused'; }
  resume() { this.status='active'; }
  disable() { this.status='disabled'; }
  updateConfig(c) {
    if (c.autonomyLevel) this.autonomyLevel=c.autonomyLevel;
    if (c.spendingLimit!==undefined) this.spendingLimit=c.spendingLimit;
    if (c.status) this.status=c.status;
  }
}
module.exports = AgentBase;

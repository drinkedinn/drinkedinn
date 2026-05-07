/**
 * Orchestrator — Manages all 16 agents, inter-agent communication,
 * collaboration, and real-time event broadcasting for DrinkedInn.
 */
const AgentBase = require('./AgentBase');
const AGENT_ROLES = require('./roles');
const DecisionEngine = require('./decisionEngine');
const LLMProvider = require('./llmProvider');
const crypto = require('crypto');

class Orchestrator {
  constructor(db, orgConfig = {}) {
    this.db = db; // DrinkedInn's SQLite database
    this.orgConfig = orgConfig;
    this.agents = {};
    this.llm = new LLMProvider(orgConfig.llm || {});
    this.decisionEngine = new DecisionEngine(orgConfig, db);
    this.activityFeed = [];
    try {
      const globalConfigRow = this.db.prepare("SELECT config_json FROM agent_configs WHERE key='global'").get();
      if (globalConfigRow) {
        this.orgConfig = JSON.parse(globalConfigRow.config_json);
        this.llm = new LLMProvider(this.orgConfig.llm || {});
      }
      const activitiesRows = this.db.prepare("SELECT data_json FROM agent_activities ORDER BY created_at ASC LIMIT 100").all();
      this.activityFeed = activitiesRows.map(r => JSON.parse(r.data_json));
    } catch(e) {}
    this.wsClients = new Set();
    this._initAgents();
  }

  _initAgents() {
    Object.entries(AGENT_ROLES).forEach(([key, config]) => {
      const a = new AgentBase(config, this.llm, this);
      try {
        const row = this.db.prepare("SELECT config_json FROM agent_configs WHERE key=?").get(key);
        if (row) a.updateConfig(JSON.parse(row.config_json));
      } catch(e) {}
      this.agents[key] = a;
    });
  }

  addWSClient(ws) { this.wsClients.add(ws); }
  removeWSClient(ws) { this.wsClients.delete(ws); }
  broadcast(event, data) {
    const msg = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
  }

  /** Get real platform stats from DrinkedInn's DB */
  getDBStats() {
    try {
      const users = this.db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const posts = this.db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
      const cheers = this.db.prepare('SELECT COUNT(*) as c FROM cheers').get().c;
      const groups = this.db.prepare('SELECT COUNT(*) as c FROM drink_groups').get().c;
      const events = this.db.prepare('SELECT COUNT(*) as c FROM events').get().c;
      const challenges = this.db.prepare('SELECT COUNT(*) as c FROM challenges').get().c;
      const ratings = this.db.prepare('SELECT COUNT(*) as c FROM drink_ratings').get().c;
      const messages = this.db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
      const collections = this.db.prepare('SELECT COUNT(*) as c FROM collection').get().c;
      return { users, posts, cheers, groups, events, challenges, ratings, messages, collections };
    } catch (e) { return {}; }
  }

  async submitTask(agentKey, task, context = {}) {
    const agent = this.agents[agentKey];
    if (!agent) throw new Error(`Agent ${agentKey} not found`);
    if (agent.status !== 'active') throw new Error(`Agent ${agentKey} is ${agent.status}`);

    // Inject real platform data
    context.dbStats = this.getDBStats();

    this._addActivity('task_submitted', { agentRole: agent.role, agentKey, task, submittedBy: context.submittedBy || 'owner' });
    const decision = await agent.decide(task, context);
    if (decision.tier === 1) this.executeAction(decision);
    this.decisionEngine.recordDecision(decision);
    this.broadcast('decision', decision);
    this.broadcast('agent_update', agent.getState());
    return decision;
  }

  async requestCollaboration(requestingAgentId, decision) {
    const reqAgent = Object.values(this.agents).find(a => a.id === requestingAgentId);
    if (!reqAgent) return;
    const perspectives = [];
    for (const collabRole of reqAgent.collaborators) {
      const collab = Object.values(this.agents).find(a => a.role === collabRole || Object.keys(this.agents).find(k => k === collabRole));
      const collabAgent = this.agents[collabRole];
      if (collabAgent && collabAgent.status === 'active') {
        const p = await collabAgent.collaborate(decision, reqAgent);
        perspectives.push(p);
      }
    }
    decision.collaborationResults = perspectives;
    decision.status = 'collaborative_complete';
    this.broadcast('collaboration_complete', { decision, perspectives });
    return perspectives;
  }

  async sendMessage(fromKey, toKey, message) {
    const from = this.agents[fromKey];
    const to = this.agents[toKey];
    if (!from || !to) throw new Error('Agent not found');
    const response = await to.think(`Message from ${from.role}: ${message}`, { fromAgent: from.role, dbStats: this.getDBStats() });
    this._addActivity('agent_message', { from: from.role, to: to.role, message: message.substring(0, 200) });
    this.broadcast('agent_message', { from: from.role, to: to.role, message, response, timestamp: new Date().toISOString() });
    return { from: from.role, to: to.role, message, response };
  }

  getAllStates() {
    const s = {};
    Object.entries(this.agents).forEach(([k, a]) => { s[k] = a.getState(); });
    return s;
  }
  getAgentState(key) { return this.agents[key]?.getState() || null; }

  updateAgentConfig(key, config) {
    const a = this.agents[key];
    if (!a) throw new Error(`Agent ${key} not found`);
    a.updateConfig(config);
    try { this.db.prepare("INSERT OR REPLACE INTO agent_configs (key, config_json) VALUES (?, ?)").run(key, JSON.stringify(a.getState())); } catch(e){}
    this.broadcast('agent_update', a.getState());
    return a.getState();
  }

  setAgentStatus(key, status) {
    const a = this.agents[key];
    if (!a) throw new Error(`Agent ${key} not found`);
    if (status === 'active') a.resume(); else if (status === 'paused') a.pause(); else a.disable();
    this._addActivity('status_change', { agentRole: a.role, status });
    try { this.db.prepare("INSERT OR REPLACE INTO agent_configs (key, config_json) VALUES (?, ?)").run(key, JSON.stringify(a.getState())); } catch(e){}
    this.broadcast('agent_update', a.getState());
    return a.getState();
  }

  updateGlobalConfig(config) {
    if (config.llm) {
      this.orgConfig.llm = { ...this.orgConfig.llm, ...config.llm };
      this.llm = new LLMProvider(this.orgConfig.llm);
      Object.values(this.agents).forEach(a => { a.llm = this.llm; });
      try { this.db.prepare("INSERT OR REPLACE INTO agent_configs (key, config_json) VALUES ('global', ?)").run(JSON.stringify(this.orgConfig)); } catch(e){}
      this._addActivity('config_update', { message: `LLM Provider changed to ${this.orgConfig.llm.provider}` });
    }
    return this.orgConfig;
  }

  resolveEscalation(decisionId, approved, feedback) {
    const d = this.decisionEngine.resolveDecision(decisionId, approved, feedback);
    if (d) {
      const agent = Object.values(this.agents).find(a => a.role === d.agentRole);
      if (agent) agent.handleEscalationResponse(decisionId, approved, feedback);
      this._addActivity('escalation_resolved', { agentRole: d.agentRole, approved, task: d.task });
      this.broadcast('escalation_resolved', d);
      if (approved) this.executeAction(d);
    }
    return d;
  }

  executeAction(decision) {
    if (!decision.execution || !decision.execution.command) return;
    try {
      const { command, payload } = decision.execution;
      const userId = 1; // Fallback to founder ID
      if (command === 'create_event') {
        this.db.prepare('INSERT INTO events (user_id, title, date, location, drink) VALUES (?, ?, ?, ?, ?)').run(userId, payload.title, payload.date, payload.location || '', payload.drink || '🥃');
      } else if (command === 'create_group') {
        this.db.prepare('INSERT INTO drink_groups (name, description, drink_type, created_by) VALUES (?, ?, ?, ?)').run(payload.name, payload.description, payload.drink_type || 'Mixed', userId);
      } else if (command === 'create_post') {
        this.db.prepare('INSERT INTO posts (user_id, content, drink) VALUES (?, ?, ?)').run(userId, payload.content, payload.drink || '🥃');
      }
      this._addActivity('action_executed', { agentRole: decision.agentRole, command, payload });
    } catch (e) {
      console.error('Agent Execution Error:', e.message);
      this._addActivity('action_failed', { agentRole: decision.agentRole, error: e.message });
    }
  }

  getActivityFeed(limit = 50) { return this.activityFeed.slice(-limit); }

  getStats() {
    return {
      agents: Object.keys(this.agents).length,
      activeAgents: Object.values(this.agents).filter(a => a.status === 'active').length,
      orgAgents: Object.values(this.agents).filter(a => a.category === 'org' && a.status === 'active').length,
      platformAgents: Object.values(this.agents).filter(a => a.category === 'platform' && a.status === 'active').length,
      decisions: this.decisionEngine.getStats(),
      pendingApprovals: this.decisionEngine.getPendingApprovals().length,
      activities: this.activityFeed.length,
      platform: this.getDBStats()
    };
  }

  _addActivity(type, data) {
    const a = { id: crypto.randomUUID(), type, data, timestamp: new Date().toISOString() };
    this.activityFeed.push(a);
    if (this.activityFeed.length > 500) this.activityFeed = this.activityFeed.slice(-500);
    try { this.db.prepare("INSERT INTO agent_activities (id, type, data_json) VALUES (?, ?, ?)").run(a.id, type, JSON.stringify(a)); } catch(e){}
    this.broadcast('activity', a);
  }
}

module.exports = Orchestrator;

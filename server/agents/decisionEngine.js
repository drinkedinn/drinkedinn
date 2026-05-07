/**
 * Decision Engine — Classifies, validates, and logs all agent decisions.
 */
const crypto = require('crypto');

class DecisionEngine {
  constructor(cfg = {}, db = null) {
    this.decisions = [];
    this.db = db;
    this.guardrails = {
      maxAutoSpend: cfg.maxAutoSpend || 500,
      maxDiscountPct: cfg.maxDiscountPct || 15,
      requireLegalReview: cfg.requireLegalReview !== false,
      requireOwnerForContracts: cfg.requireOwnerForContracts !== false,
      requireOwnerForHiring: cfg.requireOwnerForHiring !== false,
    };
    this.listeners = [];
    if (this.db) {
      try {
        const rows = this.db.prepare('SELECT decision_json FROM agent_decisions ORDER BY created_at ASC').all();
        this.decisions = rows.map(r => JSON.parse(r.decision_json));
      } catch (e) { console.error('Error loading decisions:', e.message); }
    }
  }
  onDecision(cb) { this.listeners.push(cb); }
  _notify(ev, data) { this.listeners.forEach(cb => cb(ev, data)); }

  recordDecision(d) {
    d.engineId = crypto.randomUUID();
    d.recordedAt = new Date().toISOString();
    d.guardrailsApplied = [];
    const t = (d.task||'').toLowerCase();
    if (d.amount && d.amount > this.guardrails.maxAutoSpend) { d.tier=3; d.status='awaiting_approval'; d.action='escalated_to_owner'; d.guardrailsApplied.push(`Spend > $${this.guardrails.maxAutoSpend}`); }
    if (this.guardrails.requireOwnerForContracts && (t.includes('contract')||t.includes('agreement')||t.includes('sign'))) { d.tier=3; d.status='awaiting_approval'; d.guardrailsApplied.push('Contracts require owner approval'); }
    if (this.guardrails.requireOwnerForHiring && (t.includes('hire')||t.includes('terminate'))) { d.tier=3; d.status='awaiting_approval'; d.guardrailsApplied.push('Hiring requires owner approval'); }
    this.decisions.push(d);
    if (this.db) {
      try {
        this.db.prepare('INSERT INTO agent_decisions (id, agent_role, agent_category, task, tier, status, reasoning, action, guardrails, decision_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(d.id, d.agentRole, d.agentCategory, d.task, d.tier, d.status, d.reasoning, d.action, JSON.stringify(d.guardrailsApplied), JSON.stringify(d), d.recordedAt);
      } catch (e) { console.error('Error saving decision:', e.message); }
    }
    this._notify('decision', d);
    return d;
  }

  getDecisions(f = {}) {
    let r = [...this.decisions];
    if (f.agentRole) r = r.filter(d => d.agentRole === f.agentRole);
    if (f.category) r = r.filter(d => d.agentCategory === f.category);
    if (f.tier) r = r.filter(d => d.tier === f.tier);
    if (f.status) r = r.filter(d => d.status === f.status);
    if (f.limit) r = r.slice(-f.limit);
    return r;
  }
  getPendingApprovals() { return this.decisions.filter(d => d.status === 'awaiting_approval'); }
  resolveDecision(id, approved, feedback='') {
    const d = this.decisions.find(x => x.id===id || x.engineId===id);
    if (d) { 
      d.status = approved?'approved':'rejected'; d.ownerFeedback=feedback; d.resolvedAt=new Date().toISOString(); 
      this._notify('resolved', d); 
      if (this.db) {
        try {
          this.db.prepare('UPDATE agent_decisions SET status=?, owner_feedback=?, resolved_at=?, decision_json=? WHERE id=?')
            .run(d.status, d.ownerFeedback, d.resolvedAt, JSON.stringify(d), d.id);
        } catch(e) {}
      }
    }
    return d;
  }
  getStats() {
    const total = this.decisions.length;
    const byTier = {1:0,2:0,3:0}, byStatus = {}, byAgent = {}, byCategory = {org:0, platform:0};
    this.decisions.forEach(d => {
      byTier[d.tier]=(byTier[d.tier]||0)+1;
      byStatus[d.status]=(byStatus[d.status]||0)+1;
      byAgent[d.agentRole]=(byAgent[d.agentRole]||0)+1;
      if (d.agentCategory) byCategory[d.agentCategory]=(byCategory[d.agentCategory]||0)+1;
    });
    return { total, byTier, byStatus, byAgent, byCategory };
  }
  updateGuardrails(g) { Object.assign(this.guardrails, g); }
}
module.exports = DecisionEngine;

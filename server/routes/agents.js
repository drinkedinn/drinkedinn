/**
 * Agent API Routes for DrinkedInn
 */
const express = require('express');
const router = express.Router();

module.exports = function(orchestrator) {
  // Dashboard
  router.get('/dashboard', (req, res) => {
    res.json({
      agents: orchestrator.getAllStates(),
      stats: orchestrator.getStats(),
      activities: orchestrator.getActivityFeed(20),
      pendingApprovals: orchestrator.decisionEngine.getPendingApprovals()
    });
  });

  // All agents
  router.get('/', (req, res) => res.json(orchestrator.getAllStates()));

  // Single agent
  router.get('/:key', (req, res) => {
    const s = orchestrator.getAgentState(req.params.key);
    if (!s) return res.status(404).json({ error: 'Agent not found' });
    res.json(s);
  });

  // Update agent config
  router.put('/:key/config', (req, res) => {
    if (req.params.key === 'global') return res.status(400).json({ error: 'Use /config endpoint' });
    try { res.json(orchestrator.updateAgentConfig(req.params.key, req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Update global config (LLM, etc)
  router.put('/global/config', (req, res) => {
    try { res.json(orchestrator.updateGlobalConfig(req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Toggle agent status
  router.put('/:key/status', (req, res) => {
    try { res.json(orchestrator.setAgentStatus(req.params.key, req.body.status)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Submit task
  router.post('/task', async (req, res) => {
    try {
      const { agentKey, task, context } = req.body;
      if (!agentKey || !task) return res.status(400).json({ error: 'agentKey and task required' });
      const decision = await orchestrator.submitTask(agentKey, task, context || {});
      res.json(decision);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Decisions
  router.get('/decisions/list', (req, res) => {
    const filters = {
      agentRole: req.query.agentRole,
      category: req.query.category,
      tier: req.query.tier ? parseInt(req.query.tier) : undefined,
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };
    res.json(orchestrator.decisionEngine.getDecisions(filters));
  });

  // Pending approvals
  router.get('/decisions/pending', (req, res) => {
    res.json(orchestrator.decisionEngine.getPendingApprovals());
  });

  // Resolve escalation
  router.post('/decisions/:id/resolve', (req, res) => {
    const { approved, feedback } = req.body;
    const d = orchestrator.resolveEscalation(req.params.id, approved, feedback);
    if (!d) return res.status(404).json({ error: 'Decision not found' });
    res.json(d);
  });

  // Agent messaging
  router.post('/message', async (req, res) => {
    try {
      const { from, to, message } = req.body;
      if (!from || !to || !message) return res.status(400).json({ error: 'from, to, message required' });
      res.json(await orchestrator.sendMessage(from, to, message));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Activity feed
  router.get('/feed/activities', (req, res) => {
    res.json(orchestrator.getActivityFeed(parseInt(req.query.limit) || 50));
  });

  // Stats
  router.get('/stats/overview', (req, res) => res.json(orchestrator.getStats()));

  return router;
};

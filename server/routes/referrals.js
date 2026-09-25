const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Get or create user's referral code
router.get('/code', auth, async (req, res) => {
  try {
    let user = await db.get('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
    if (!user.referral_code) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      await db.run('UPDATE users SET referral_code = ? WHERE id = ?', [code, req.user.id]);
      user = { referral_code: code };
    }
    // Count successful referrals
    const stats = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE referred_by = ?', [req.user.id]
    );
    res.json({ code: user.referral_code, referrals: stats?.count || 0, link: `https://drinkedinn.com/login?ref=${user.referral_code}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

// Get referral leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const leaders = await db.all(`
      SELECT u.id, u.name, u.avatar, u.title, COUNT(r.id) as referral_count
      FROM users u JOIN users r ON r.referred_by = u.id
      GROUP BY u.id ORDER BY referral_count DESC LIMIT 10
    `);
    res.json(leaders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;

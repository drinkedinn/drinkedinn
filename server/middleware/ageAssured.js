// server/middleware/ageAssured.js
// Gate an action behind a minimum age-assurance level.
//
//   requireAgeAssurance()        enforce whatever the user's country requires
//   requireAgeAssurance(1)       always require at least age estimation
//   requireAgeAssurance(2)       always require document verification
//
// Used for brand/ad content and anything a regulator would expect to sit behind
// "highly effective" age assurance. Ordinary social use stays on self-declared
// DOB — gating the whole app would be both unlawful overreach and terrible UX.

const db = require('../db');
const jurisdictions = require('../lib/jurisdictions');

const { countryOf } = require('../lib/clientCountry');
function requireAgeAssurance(minLevel = null) {
  return async (req, res, next) => {
    try {
      const user = await db.get(
        'SELECT country_code, age_assurance_level FROM users WHERE id = ?',
        [req.user.id]
      );
      const country = countryOf(req, user?.country_code);
      const rules = jurisdictions.rulesFor(country);

      // Where the platform shouldn't operate, nothing else matters.
      if (jurisdictions.isProhibited(country)) {
        return res.status(451).json({ error: 'Not available in your country.' });
      }

      const needed = minLevel !== null ? minLevel : (rules.assurance === 'enhanced' ? 1 : 0);
      const have = user?.age_assurance_level || 0;

      if (have >= needed) return next();

      return res.status(403).json({
        error: 'This needs a quick age check first.',
        code: 'AGE_ASSURANCE_REQUIRED',
        requiredLevel: needed,
        currentLevel: have,
        minAge: rules.minAge,
      });
    } catch (err) {
      console.error('[ageAssured]', err.message);
      return res.status(500).json({ error: 'Could not verify age status.' });
    }
  };
}

module.exports = { requireAgeAssurance };

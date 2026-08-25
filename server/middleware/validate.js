// server/middleware/validate.js
// Input validation with zod. Rejects malformed/oversized input before handlers run.
//
//   npm i zod
//
// Usage:
//   const { z } = require('zod');
//   const schema = z.object({ email: z.string().email(), password: z.string().min(10) });
//   router.post('/register', validate(schema), handler)

function validate(schema, where = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req[where] = result.data;
    next();
  };
}

module.exports = { validate };

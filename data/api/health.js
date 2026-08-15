export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    ok: true,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    loginProtected: Boolean(process.env.STUDIO_LOGIN_PASSWORD),
    models: {
      suggestions: process.env.OPENAI_SUGGEST_MODEL || 'gpt-5.6-luna',
      review: process.env.OPENAI_REVIEW_MODEL || 'gpt-5.6-terra',
      deepReview: process.env.OPENAI_DEEP_MODEL || 'gpt-5.6-sol',
      storyTools: process.env.OPENAI_ANALYZE_MODEL || 'gpt-5.6-terra'
    }
  });
}

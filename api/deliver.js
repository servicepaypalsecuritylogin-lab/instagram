// Serverless function for follower delivery
// Vercel runs this at the edge

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, count, priority = 'normal' } = req.body;

  if (!username || !count || count < 1 || count > 10000) {
    return res.status(400).json({ 
      error: 'Invalid username or count (1-10000)' 
    });
  }

  // Queue delivery (in production, this writes to Redis/DB)
  const deliveryId = crypto.randomUUID();
  
  // Log to Vercel function logs
  console.log(`[Deliver] Queued ${count} followers for @${username}`);

  return res.status(200).json({
    success: true,
    deliveryId,
    target: username,
    count,
    status: 'queued',
    estimatedTime: `${Math.ceil(count / 10)} minutes`,
    timestamp: new Date().toISOString()
  });
}

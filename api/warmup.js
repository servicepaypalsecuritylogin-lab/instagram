export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { username } = req.query;

  return res.status(200).json({
    username: username || 'unknown',
    stage: 'engager',
    progress: 67,
    daysRemaining: 5,
    isReady: false,
    dailyActions: 12,
    actionLimits: {
      follow: 8,
      like: 25,
      comment: 5
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Delivery ID required' });
  }

  // In production, fetch from database
  // This is a mock response
  return res.status(200).json({
    deliveryId: id,
    status: 'in_progress',
    delivered: 450,
    total: 1000,
    progress: 45,
    eta: '6 minutes'
  });
}

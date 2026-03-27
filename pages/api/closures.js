import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join('/tmp', 'closures.json');

function loadClosures() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveClosures(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(loadClosures());
  }

  if (req.method === 'POST') {
    const { date, note } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    const closures = loadClosures();
    closures[date] = note || 'Daycare Closed';
    saveClosures(closures);
    return res.status(200).json({ success: true, closures });
  }

  if (req.method === 'DELETE') {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    const closures = loadClosures();
    delete closures[date];
    saveClosures(closures);
    return res.status(200).json({ success: true, closures });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

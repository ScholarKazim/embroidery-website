const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'universities.json'), 'utf8');
    res.status(200).send(raw);
  } catch (err) {
    res.status(200).json({ success: true, universities: [] });
  }
};

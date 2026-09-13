const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'batches.json'), 'utf8');
    const batches = JSON.parse(raw);
    res.status(200).json({ success: true, count: batches.length, batches });
  } catch (err) {
    res.status(200).json({
      success: true,
      count: 1,
      batches: [
        {
          id: "BATCH-2026-ENG",
          title: "دفعة كلية الهندسة — جامعة بغداد",
          university: "جامعة بغداد",
          college: "كلية الهندسة",
          repName: "علي مهدي",
          repPhone: "07801234567",
          color: "burgundy",
          colorName: "ماروني ملكي",
          targetQty: 50,
          status: "مفتوح للتسجيل",
          createdAt: "2026-09-13T12:00:00",
          students: []
        }
      ]
    });
  }
};

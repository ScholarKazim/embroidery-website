module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  const body = req.body || {};
  const randId = "BATCH-" + Math.floor(100000 + Math.random() * 900000);
  const newBatch = {
    id: randId,
    title: body.title || ("دفعة " + (body.college || "التخرج") + " — " + (body.university || "الجامعة")),
    university: body.university,
    college: body.college,
    repName: body.repName,
    repPhone: body.repPhone,
    color: body.color || "burgundy",
    colorName: body.colorName || "ماروني ملكي",
    targetQty: body.targetQty || 50,
    status: "مفتوح للتسجيل",
    createdAt: new Date().toISOString(),
    students: []
  };
  return res.status(201).json({ success: true, batchId: randId, batch: newBatch });
};

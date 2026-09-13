module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'POST') {
    const body = req.body || {};
    const orderId = body.id || ("KH-" + Math.floor(100000 + Math.random() * 900000));
    return res.status(200).json({ success: true, message: "تم تسجيل الطلب بنجاح", orderId });
  }
  return res.status(200).json([]);
};

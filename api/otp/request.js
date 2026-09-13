// Serverless Cloud OTP Request Handler (Vercel & Netlify)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    let phone = String(body.phone || '').replace(/[^\d+]/g, '').trim();

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف عراقي صالح' });
    }

    if (phone.startsWith('07')) phone = '+964' + phone.substring(1);
    else if (phone.startsWith('7')) phone = '+964' + phone;

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    return res.status(200).json({
      success: true,
      message: 'تم إرسال رمز التحقق Cloud OTP إلى هاتفك بنجاح',
      phone: phone,
      simulatedCode: code,
      expiresIn: 300
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

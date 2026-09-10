# توثيق واجهة برمجة التطبيقات (API Specification)
## نظام تصويت ألوان الكليات الجامعية

---

### الأساسيات (General Info)
- **Base URL**: `http://localhost:4000/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: `Bearer <JWT_TOKEN>` للمسارات المحمية الخاصة بممثلي الكليات.
- **Student Identification**: تلقائي عبر كوكيز `ik_student_session` أو عبر ترويسة مخصصة `X-Student-Identifier`.

---

## 1. المصادقة والتحقق (Authentication)

### 1.1 طلب رمز التحقق (Request OTP)
إرسال رمز OTP مكون من 6 أرقام مشفر بـ Bcrypt عبر مزود خدمة SMS.

- **المسار**: `POST /auth/request-otp`
- **الصلاحية**: عام (محدد بـ 3 طلبات كل 10 دقائق لكل IP)
- **جسم الطلب (Request Body)**:
```json
{
  "phone": "07701234567"
}
```
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "message": "تم إرسال رمز التحقق بنجاح",
  "expiresInSeconds": 300
}
```
- **استجابة الخطأ (429 Too Many Requests)**:
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "تجاوزت الحد المسموح به لطلبات رمز التحقق. يرجى المحاولة بعد 10 دقائق"
}
```

---

### 1.2 التحقق من الرمز وتسجيل الدخول (Verify OTP)
التحقق من صحة الرمز، تفعيل حساب الممثل وإصدار توكن JWT.

- **المسار**: `POST /auth/verify-otp`
- **الصلاحية**: عام (محدد بـ 5 محاولات كل 10 دقائق)
- **جسم الطلب (Request Body)**:
```json
{
  "phone": "07701234567",
  "otp": "123456",
  "name": "أحمد علي"
}
```
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "message": "تم التحقق بنجاح",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "representative": {
    "id": "c1f7a08b-b6d3-4819-bf9b-38167f2bc212",
    "phone": "07701234567",
    "name": "أحمد علي",
    "isVerified": true
  }
}
```
- **استجابة الخطأ (400 Bad Request)**:
```json
{
  "success": false,
  "error": "INVALID_OTP",
  "message": "رمز التحقق غير صحيح أو منتهي الصلاحية"
}
```

---

## 2. الجامعات والكليات (Universities & Colleges)

### 2.1 جلب قائمة الجامعات
- **المسار**: `GET /universities`
- **الصلاحية**: عام
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "0b15bfae-4f38-4e1e-bfa1-e6e7d6ca04b0",
      "name": "جامعة بغداد",
      "code": "UOB",
      "createdAt": "2026-09-09T10:00:00.000Z",
      "_count": {
        "colleges": 4
      }
    }
  ]
}
```

---

### 2.2 جلب كليات جامعة محددة
- **المسار**: `GET /universities/:id/colleges`
- **الصلاحية**: عام
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "university": {
    "id": "0b15bfae-4f38-4e1e-bfa1-e6e7d6ca04b0",
    "name": "جامعة بغداد",
    "code": "UOB"
  },
  "colleges": [
    {
      "id": "4a73ecbc-6c84-4824-a787-8495bcfa3021",
      "name": "كلية الطب",
      "code": "MED",
      "fixedEntityId": "baghdad-med-entity-01",
      "createdAt": "2026-09-09T10:00:00.000Z"
    }
  ]
}
```

---

## 3. التصويت وإدارة الاستفتاء (Votes)

### 3.1 إنشاء تصويت جديد (Create Vote)
يقوم ممثل الكلية بإنشاء تصويت. يقوم النظام آلياً بجلب `fixedEntityId` المرتبط بالكلية وربطه بالتصويت، وتوليد رمز مشاركة عشوائي مشفر (`shareToken`).

- **المسار**: `POST /votes`
- **الصلاحية**: محمي (الممثل فقط عبر `Authorization: Bearer <TOKEN>`)
- **جسم الطلب (Request Body)**:
```json
{
  "collegeId": "4a73ecbc-6c84-4824-a787-8495bcfa3021",
  "title": "تصويت اختيار لون وشاح تخرج دفعة 2026",
  "description": "يرجى من جميع طلبة المرحلة الرابعة التصويت على اللون المفضل لوشاح التخرج الرسمي",
  "durationDays": 5,
  "colors": [
    {
      "colorName": "الماروني الملكي (Burgundy)",
      "colorHex": "#722F37",
      "previewImageUrl": "https://ibra-wakhayt.iq/colors/burgundy.jpg"
    },
    {
      "colorName": "الكحلي الدبلوماسي (Navy Blue)",
      "colorHex": "#0A192F",
      "previewImageUrl": "https://ibra-wakhayt.iq/colors/navy.jpg"
    },
    {
      "colorName": "الزمردي الإمبراطوري (Emerald Green)",
      "colorHex": "#004D40",
      "previewImageUrl": "https://ibra-wakhayt.iq/colors/emerald.jpg"
    }
  ]
}
```
- **الاستجابة الناجحة (201 Created)**:
```json
{
  "success": true,
  "message": "تم إنشاء التصويت بنجاح",
  "data": {
    "id": "e81d77a0-0d35-4428-98e6-e91b5c468e41",
    "representativeId": "c1f7a08b-b6d3-4819-bf9b-38167f2bc212",
    "collegeId": "4a73ecbc-6c84-4824-a787-8495bcfa3021",
    "fixedEntityId": "baghdad-med-entity-01",
    "title": "تصويت اختيار لون وشاح تخرج دفعة 2026",
    "description": "يرجى من جميع طلبة المرحلة الرابعة التصويت على اللون المفضل لوشاح التخرج الرسمي",
    "status": "ACTIVE",
    "shareToken": "xK9mP2vL8qR5wY3nB7tC4dF1",
    "shareUrl": "http://localhost:4000/vote/xK9mP2vL8qR5wY3nB7tC4dF1",
    "startsAt": "2026-09-09T12:00:00.000Z",
    "endsAt": "2026-09-14T12:00:00.000Z",
    "colors": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "colorName": "الماروني الملكي (Burgundy)",
        "colorHex": "#722F37",
        "previewImageUrl": "https://ibra-wakhayt.iq/colors/burgundy.jpg"
      },
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "colorName": "الكحلي الدبلوماسي (Navy Blue)",
        "colorHex": "#0A192F",
        "previewImageUrl": "https://ibra-wakhayt.iq/colors/navy.jpg"
      }
    ]
  }
}
```

---

### 3.2 إنهاء التصويت يدويًا (End Vote Manually)
يسمح لممثل الكلية (مالك التصويت فقط) بإغلاق التصويت قبل موعد انتهائه.

- **المسار**: `POST /votes/:id/end`
- **الصلاحية**: محمي (الممثل المالك فقط)
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "message": "تم إنهاء التصويت بنجاح",
  "data": {
    "id": "e81d77a0-0d35-4428-98e6-e91b5c468e41",
    "status": "ENDED",
    "endsAt": "2026-09-09T15:30:00.000Z"
  }
}
```

---

### 3.3 عرض صفحة التصويت للطلبة (Get Vote for Students)
جلب بيانات التصويت عبر رابط المشاركة مع تحديد حالة تصويت الطالب الحالي إن كان قد صوت مسبقاً.

- **المسار**: `GET /votes/token/:token` أو `GET /votes/:token`
- **الصلاحية**: عام (مع جلسة بصمة المتصفح/الجهاز)
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "e81d77a0-0d35-4428-98e6-e91b5c468e41",
    "title": "تصويت اختيار لون وشاح تخرج دفعة 2026",
    "description": "يرجى من جميع طلبة المرحلة الرابعة التصويت...",
    "status": "ACTIVE",
    "startsAt": "2026-09-09T12:00:00.000Z",
    "endsAt": "2026-09-14T12:00:00.000Z",
    "remainingSeconds": 432000,
    "college": {
      "name": "كلية الطب",
      "university": {
        "name": "جامعة بغداد"
      }
    },
    "colors": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "colorName": "الماروني الملكي (Burgundy)",
        "colorHex": "#722F37",
        "previewImageUrl": "https://ibra-wakhayt.iq/colors/burgundy.jpg"
      },
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "colorName": "الكحلي الدبلوماسي (Navy Blue)",
        "colorHex": "#0A192F",
        "previewImageUrl": "https://ibra-wakhayt.iq/colors/navy.jpg"
      }
    ],
    "myChoiceColorId": null
  }
}
```

---

### 3.4 إدلاء الطالب بصوته أو تعديله (Cast or Update Vote)
التصويت الفعلي للطلبة بدون الحاجة لتسجيل حساب. يدعم النظام **تعديل الصوت (Upsert)** طالما التصويت نشط (`ACTIVE`). في حال انتهاء التصويت (`ENDED`) يتم رفض أي تصويت جديد أو تعديل.

- **المسار**: `POST /votes/token/:token/choice` أو `POST /votes/:token/choice`
- **الصلاحية**: عام (بصمة المتصفح عبر الكوكيز / الترويسة)
- **جسم الطلب (Request Body)**:
```json
{
  "colorId": "11111111-1111-1111-1111-111111111111"
}
```
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "message": "تم تسجيل اختيارك بنجاح",
  "data": {
    "id": "7b88ecbc-4c84-4824-a787-8495bcfa9999",
    "voteId": "e81d77a0-0d35-4428-98e6-e91b5c468e41",
    "colorId": "11111111-1111-1111-1111-111111111111",
    "createdAt": "2026-09-09T15:40:00.000Z",
    "updatedAt": "2026-09-09T15:40:00.000Z"
  }
}
```
- **استجابة الرفض عند انتهاء التصويت (400 Bad Request)**:
```json
{
  "success": false,
  "error": "VOTE_ENDED",
  "message": "عذراً، هذا التصويت منتهي ولا يمكن استقبال أو تعديل أي أصوات حالياً"
}
```

---

### 3.5 عرض النتائج والإحصائيات (Get Vote Results)
جلب النتائج الإجمالية، عدد الأصوات ونسبة كل لون، وتحديد اللون الفائز تلقائياً.

- **المسار**: `GET /votes/:id/results`
- **الصلاحية**: عام
- **الاستجابة الناجحة (200 OK)**:
```json
{
  "success": true,
  "data": {
    "vote": {
      "id": "e81d77a0-0d35-4428-98e6-e91b5c468e41",
      "title": "تصويت اختيار لون وشاح تخرج دفعة 2026",
      "status": "ACTIVE",
      "startsAt": "2026-09-09T12:00:00.000Z",
      "endsAt": "2026-09-14T12:00:00.000Z",
      "collegeName": "كلية الطب",
      "universityName": "جامعة بغداد"
    },
    "totalVotes": 150,
    "winningColor": {
      "id": "11111111-1111-1111-1111-111111111111",
      "colorName": "الماروني الملكي (Burgundy)",
      "colorHex": "#722F37",
      "votesCount": 90,
      "percentage": 60
    },
    "results": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "colorName": "الماروني الملكي (Burgundy)",
        "colorHex": "#722F37",
        "previewImageUrl": "https://ibra-wakhayt.iq/colors/burgundy.jpg",
        "votesCount": 90,
        "percentage": 60
      },
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "colorName": "الكحلي الدبلوماسي (Navy Blue)",
        "colorHex": "#0A192F",
        "previewImageUrl": "https://ibra-wakhayt.iq/colors/navy.jpg",
        "votesCount": 60,
        "percentage": 40
      }
    ]
  }
}
```

---

## 4. أمثلة اختبار سريعة بـ cURL (cURL Quick Tests)

```bash
# 1. طلب رمز OTP
curl -X POST http://localhost:4000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "07701234567"}'

# 2. التحقق من الرمز
curl -X POST http://localhost:4000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "07701234567", "otp": "123456", "name": "أحمد علي"}'

# 3. جلب قائمة الجامعات
curl http://localhost:4000/api/v1/universities

# 4. إنشاء تصويت (ضع التوكن المستلم من الخطوة 2)
curl -X POST http://localhost:4000/api/v1/votes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "collegeId": "<COLLEGE_UUID>",
    "title": "تصويت لون وشاح التخرج",
    "durationDays": 5,
    "colors": [
      {"colorName": "الماروني", "colorHex": "#722F37"},
      {"colorName": "الكحلي", "colorHex": "#0A192F"}
    ]
  }'

# 5. تصويت طالب بدون تسجيل دخول
curl -X POST http://localhost:4000/api/v1/votes/<SHARE_TOKEN>/choice \
  -H "Content-Type: application/json" \
  -d '{"colorId": "<COLOR_UUID>"}'

# 6. جلب النتائج
curl http://localhost:4000/api/v1/votes/<VOTE_UUID>/results
```

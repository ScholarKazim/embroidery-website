# نظام تصويت ألوان الكليات الجامعية (College Colors Voting System)
### الخادم الخلفي، قاعدة البيانات، وتوثيق واجهات البرمجة (Backend, Database & API)

نظام متكامل، آمن وعالي الأداء مبني باستخدام **Node.js, Express, TypeScript, PostgreSQL, Prisma ORM**.
يتيح النظام لممثلي الكليات التحقق من أرقام هواتفهم عبر رمز OTP، إنشاء وإدارة استفتاءات ألوان أوشحة التخرج، ومشاركة الروابط مع الطلبة للتصويت بسهولة دون الحاجة لإنشاء حسابات، مع حماية أمنية مشددة تمنع التلاعب وتكرار التصويت.

---

## 🌟 الميزات الرئيسية (Key Features)

1. **التحقق الآمن لممثل الكلية (OTP via SMS):**
   - توليد رموز تحقق رقمية مشفرة باستخدام خوارزمية **Bcrypt** قبل حفظها في قاعدة البيانات.
   - تحديد صلاحية الرمز بـ 5 دقائق، وبحد أقصى 3 محاولات خاطئة لمنع هجمات التخمين (Brute-force).
   - إصدار رمز مصادقة مشفر **JWT (JSON Web Token)** بصلاحية قابلة للضبط.

2. **طبقة مجردة وقابلة للتبديل لمزودي الرسائل (Pluggable SMS Provider):**
   - واجهة برمجية موحدة `ISmsProvider`.
   - دعم التبديل السلس عبر متغير البيئة `SMS_PROVIDER`:
     - `mock`: لبيئة التطوير والاختبار المحلي (طباعة الرمز في Terminal مباشرة دون تكلفة).
     - `twilio`: للتكامل الدولي المباشر مع Twilio API.
     - `local_gateway`: للتكامل مع بوابات الرسائل العراقية والمحلية.

3. **الربط التلقائي للجهة الثابتة (Automatic Fixed Entity ID Binding):**
   - كل كلية مرتبطة بجهة مسبقة الإعداد (`fixedEntityId`).
   - عند إنشاء التصويت، يستخرج الخادم هذا المعرف تلقائياً من الكلية دون أي إدخال يدوي من الممثل.

4. **توليد روابط مشاركة مشفرة وآمنة (Cryptographic Share Tokens):**
   - استخدام مولد عشوائي آمن لإنشاء `shareToken` بطول 24 خانة، يصعب تخمينه تماماً.

5. **نظام تصويت ذكي للطلبة دون تسجيل (Seamless Student Voting):**
   - تصويت فوري بنقرة واحدة عبر بصمة الجلسة والجهاز (`ik_student_session` أو الترويسة `X-Student-Identifier`).
   - قيد قاعدة بيانات فريد `UNIQUE(vote_id, student_identifier)` يدعم ميزة **تحديث الخيار (Upsert)** طالما التصويت نشط.
   - منع التكرار العشوائي والتلاعب.

6. **إدارة دورة حياة التصويت (Lifecycle & Auto-Expiration):**
   - مدة التصويت محددة بين 3 إلى 7 أيام.
   - إمكانية إنهاء التصويت يدويًا من قبل ممثل الكلية فقط (مع التحقق من الملكية).
   - مهمة مجدولة في الخلفية عبر **Node-Cron** تفحص وتنهي الاستفتاءات المنتهية تلقائياً كل دقيقة.
   - رفض قاطع لأي تصويت أو تعديل فور إغلاق الاستفتاء (`status = ENDED`).

7. **الأمان ومعدلات الطلب (Security & Rate Limiting):**
   - حماية ضد هجمات الـ DoS والسبام عبر `express-rate-limit`.
   - تدريع الترويسات بواسطة `helmet` وسياسات `cors`.

---

## 🗄️ هيكل قاعدة البيانات (Database Schema & Models)

تم تصميم قاعدة البيانات في PostgreSQL عبر Prisma بأعلى معايير الـ Normalization:

- **`universities`**: قائمة الجامعات (الاسم، الرمز الكودي).
- **`colleges`**: الكليات، مرتبطة بالجامعة ومزودة بـ `fixed_entity_id`.
- **`representatives`**: حسابات ممثلي الكليات (الاسم، رقم الهاتف، حالة التحقق).
- **`otp_codes`**: سجل رموز OTP المشفرة بـ Bcrypt، عدد المحاولات وتاريخ الانتهاء.
- **`votes`**: الاستفتاءات (العنوان، الوصف، الحالة ACTIVE/ENDED، تاريخ البدء والانتهاء، رابط المشاركة، ومعرف الكلية والجهة).
- **`vote_colors`**: خيارات الألوان المتاحة لكل تصويت (اسم اللون، كود HEX، ورابط الصورة النموذجية).
- **`vote_choices`**: أصوات الطلبة (معرف التصويت، معرف اللون، بصمة الطالب، IP، و User-Agent).

---

## 🚀 دليل التثبيت والتشغيل المحلي (Setup & Execution)

### المتطلبات الأساسية
- **Node.js**: الإصدار 18 أو أحدث.
- **PostgreSQL**: قاعدة بيانات جاهزة (محلية أو سحابية مثل Supabase / Neon / Railway).

### 1. تثبيت الحزم (Install Dependencies)
```bash
cd voting-backend
npm install
```

### 2. إعداد متغيرات البيئة (Environment Variables)
قم بنسخ ملف `.env.example` إلى `.env`:
```bash
cp .env.example .env
```
وقم بتعديل رابط قاعدة البيانات `DATABASE_URL`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/college_voting?schema=public"
```

### 3. تطبيق ترحيل قاعدة البيانات (Run Prisma Migrations)
```bash
npx prisma migrate dev --name initial_schema
```
أو توليد عميل Prisma:
```bash
npx prisma generate
```

### 4. حقن البيانات الأولية للجامعات والكليات (Seed Data)
```bash
npx prisma db seed
```
*سيتم حقن بيانات جامعة بغداد، جامعة كربلاء، وجامعة بابل بكلياتها والجهات الثابتة المرتبطة بها.*

### 5. تشغيل الخادم في وضع التطوير (Run Development Server)
```bash
npm run dev
```
سيعمل الخادم على: `http://localhost:4000`

---

## 📁 هيكلية مجلدات المشروع (Project Structure)

```text
voting-backend/
├── docs/
│   └── api-specification.md      # التوثيق الكامل لجميع واجهات البرمجة مع أمثلة cURL
├── prisma/
│   ├── migrations/               # ملفات ترحيل SQL الجاهزة
│   ├── schema.prisma             # مخطط قاعدة البيانات
│   └── seed.ts                   # ملف حقن الجامعات والكليات والجهات الثابتة
├── src/
│   ├── config/                   # قراءة متغيرات البيئة مع التحقق من صحتها
│   ├── lib/
│   │   ├── jwt.ts                # تشفير وفك توكنات JWT
│   │   ├── otp-hash.ts           # توليد وتشفير الـ OTP بـ Bcrypt
│   │   └── prisma.ts             # عميل Prisma Client الموحد
│   ├── middlewares/
│   │   ├── auth.middleware.ts    # التحقق من هوية الممثل
│   │   ├── error-handler.middleware.ts # معالجة الأخطاء الموحدة
│   │   ├── rate-limiter.middleware.ts  # حدود الطلبات والأمان
│   │   └── student-session.middleware.ts # إدارة بصمة جلسة الطالب
│   ├── routes/
│   │   ├── auth.routes.ts        # مسارات OTP والمصادقة
│   │   ├── university.routes.ts  # مسارات استعراض الجامعات والكليات
│   │   ├── vote.routes.ts        # مسارات إدارة والتصويت
│   │   └── index.ts              # تجميع المسارات
│   ├── services/
│   │   ├── sms/                  # طبقة مزودي رسائل SMS (Mock, Twilio, Local)
│   │   ├── otp.service.ts        # منطق الـ OTP وإصدار الحسابات
│   │   └── vote.service.ts       # المنطق التجاري للتصويت والنتائج
│   ├── validators/               # مخططات Zod للتحقق من المدخلات
│   ├── app.ts                    # إعداد Express والميدلوير
│   └── server.ts                 # بدء الاستماع ومهام Cron المجدولة
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 التحقق والاختبار (Verification & Testing)

يمكنك اختبار كامل دورة النظام من خلال الخطوات التالية (أو مراجعة ملف `docs/api-specification.md`):

1. **فحص جاهزية الخادم:**
   `GET http://localhost:4000/api/v1/health`
2. **طلب رمز OTP:**
   `POST http://localhost:4000/api/v1/auth/request-otp` ببيانات `{"phone": "07701234567"}`.
   *(في وضع mock، سيظهر الرمز في شاشة الـ Console فوراً).*
3. **تأكيد الرمز والحصول على JWT:**
   `POST http://localhost:4000/api/v1/auth/verify-otp` مع الرمز واسم الممثل.
4. **إنشاء تصويت:**
   `POST http://localhost:4000/api/v1/votes` مع ترويسة `Authorization: Bearer <TOKEN>`.
5. **مشاركة الرابط وتصويت الطلبة:**
   `POST http://localhost:4000/api/v1/votes/<TOKEN>/choice` مع `{"colorId": "<COLOR_ID>"}`.
6. **متابعة النتائج الحية:**
   `GET http://localhost:4000/api/v1/votes/<VOTE_ID>/results`.

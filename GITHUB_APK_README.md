# منبه الفجر واليقظة — بناء APK عبر GitHub Actions

ارفع **كل محتويات هذا المجلد** إلى جذر مستودع GitHub، مع المجلد المخفي `.github`.

بعد الرفع:
1. افتح تبويب **Actions**.
2. اختر **Build Android APK**.
3. اضغط **Run workflow** (أو ادفع commit إلى main).
4. بعد نجاح البناء، افتح العملية ثم **Artifacts**.
5. حمّل `fajr-alarm-debug-apk`، فك الضغط، وثبّت `app-debug.apk`.

ملاحظة: نسخة Release هنا unsigned للاختبار؛ لا تستخدمها للنشر في Google Play قبل إعداد توقيع Android.

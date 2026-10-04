package ir.lexa.app;

/* ─── Lexa — پلاگین به‌روزرسانی درون‌برنامه‌ای APK ────────────────────────────
 * دانلود APK نسخهٔ جدید (با رویداد پیشرفت) + بازکردن نصاب سیستم با FileProvider.
 * چرا دانلود بومی؟ فایل چندمگابایتی به‌جای عبور از لایهٔ JS/WebView مستقیم روی
 * دیسک نوشته می‌شود؛ پیشرفت هم با notifyListeners به رندرر می‌رسد.
 * نصب با ACTION_INSTALL_PACKAGE — روی اندروید ۸+ نیازمند اجازهٔ
 * REQUEST_INSTALL_PACKAGES است؛ اگر کاربر اجازه نداده، openPermissionSettings
 * صفحهٔ رسمی سیستم را باز می‌کند تا با یک کلید ساده اجازه بدهد و دوباره بزند.
 * ─────────────────────────────────────────────────────────────────────────── */

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

@CapacitorPlugin(name = "LexaUpdater")
public class LexaUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** آیا این دستگاه اجازهٔ نصب بسته از منبع خارجی را داده؟ */
    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        } else {
            allowed = true; // پیش از اندروید ۸ محدودیتی وجود ندارد
        }
        JSObject ret = new JSObject();
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    /** بازکردن صفحهٔ رسمی «نصب برنامه‌های ناشناس» برای همین اپ */
    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent i = new Intent(
                        android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) {
                call.reject("OPEN_SETTINGS_FAILED", e.getMessage());
                return;
            }
        }
        call.resolve();
    }

    /**
     * دانلود APK و سپس بازکردن نصاب سیستم.
     * ورودی: url (الزامی)، sha256 (اختیاری — hex).
     * رویداد progress: {bytesDone, bytesTotal} — bytesTotal ممکن است -1 باشد.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        final String url = call.getString("url");
        final String sha256 = call.getString("sha256");
        if (url == null || url.isEmpty()) {
            call.reject("NO_URL", "نشانی فایل خالی است");
            return;
        }
        final String digest = (sha256 == null || sha256.isEmpty()) ? null : sha256.toLowerCase();

        executor.execute(() -> {
            File apk = null;
            try {
                File dir = new File(getContext().getCacheDir(), "update");
                if (!dir.exists()) dir.mkdirs();
                // پاک‌سازی بسته‌های قبلی — همیشه فقط آخرین نسخه روی دیسک می‌ماند
                File[] olds = dir.listFiles();
                if (olds != null) for (File f : olds) if (f.isFile()) f.delete();
                apk = new File(dir, "lexa-update.apk");

                OkHttpClient client = new OkHttpClient.Builder()
                        .connectTimeout(20, TimeUnit.SECONDS)
                        .readTimeout(120, TimeUnit.SECONDS)
                        .build();
                Request req = new Request.Builder().url(url).build();
                Response resp = client.newCall(req).execute();
                try {
                    if (!resp.isSuccessful() || resp.body() == null) {
                        call.reject("DOWNLOAD_FAILED", "HTTP " + resp.code());
                        return;
                    }
                    long total = resp.body().contentLength(); // ممکن است -1 باشد
                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    InputStream in = resp.body().byteStream();
                    FileOutputStream out = new FileOutputStream(apk);
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int n;
                    long lastEmit = 0;
                    long emitStep = total > 0 ? Math.max(256 * 1024, total / 20) : 512 * 1024;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        md.update(buf, 0, n);
                        done += n;
                        if (done - lastEmit >= emitStep) {
                            lastEmit = done;
                            JSObject p = new JSObject();
                            p.put("bytesDone", done);
                            p.put("bytesTotal", total);
                            notifyListeners("progress", p);
                        }
                    }
                    out.flush();
                    out.close();
                    in.close();

                    if (digest != null) {
                        StringBuilder sb = new StringBuilder();
                        for (byte b : md.digest()) sb.append(String.format("%02x", b));
                        if (!sb.toString().equals(digest)) {
                            apk.delete();
                            call.reject("CHECKSUM_MISMATCH", "امضای فایل با نسخهٔ رسمی یکی نیست");
                            return;
                        }
                    }
                } finally {
                    resp.close();
                }

                Uri uri = FileProvider.getUriForFile(
                        getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                intent.setData(uri);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);

                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("path", apk.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                if (apk != null && apk.exists()) apk.delete();
                call.reject("INSTALL_FAILED", e.getMessage());
            }
        });
    }
}

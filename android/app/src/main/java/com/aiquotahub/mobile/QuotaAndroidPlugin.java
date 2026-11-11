package com.aiquotahub.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "QuotaAndroid")
public class QuotaAndroidPlugin extends Plugin {
    private static final String ALIAS = "AIQuotaHubAES";
    private static final Set<String> KINDS = new HashSet<>();
    static { KINDS.add("deepseek"); KINDS.add("openai-api"); KINDS.add("openrouter"); KINDS.add("relay"); }

    private SharedPreferences store() {
        return getContext().getSharedPreferences("aiquotahub.secrets.v1", Context.MODE_PRIVATE);
    }

    private String validate(PluginCall call) {
        String kind = call.getString("kind", "");
        String id = call.getString("id", "");
        if (!KINDS.contains(kind) || !id.matches("^[a-zA-Z0-9][a-zA-Z0-9_-]{1,100}$")) {
            throw new IllegalArgumentException("账号类型或账号标识不正确");
        }
        return kind;
    }

    @PluginMethod
    public void connected(PluginCall call) {
        JSArray ids = new JSArray();
        for (Map.Entry<String, ?> entry : store().getAll().entrySet()) {
            Object raw = entry.getValue();
            if (raw instanceof String && ((String)raw).contains("|")) ids.put(entry.getKey());
        }
        JSObject answer = new JSObject();
        answer.put("ids", ids);
        call.resolve(answer);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        final String kind;
        try { kind = validate(call); } catch (Exception e) { call.reject(e.getMessage()); return; }
        final String id = call.getString("id");
        final String key = call.getString("key", "").trim();
        final JSObject relay = call.getObject("relay", new JSObject());
        if (key.length() < 8 || key.length() > 4096) { call.reject("请输入有效的官方密钥"); return; }
        new Thread(() -> {
            try {
                JSObject result = fetchLive(kind, key, relay);
                String sealed = encrypt(key);
                if (!store().edit().putString(id, kind + "|" + sealed + ("relay".equals(kind) ? "|" + encrypt(relay.toString()) : "")).commit()) throw new Exception("保存密钥失败");
                QuotaHomeWidget.refreshAll(getContext());
                call.resolve(result);
            } catch (Exception e) { call.reject("绑定失败：" + safeMessage(e)); }
        }, "quota-connect").start();
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        final String kind;
        try { kind = validate(call); } catch (Exception e) { call.reject(e.getMessage()); return; }
        final String id = call.getString("id");
        new Thread(() -> {
            try {
                String value = store().getString(id, "");
                if (!value.startsWith(kind + "|")) throw new Exception("该账号尚未绑定");
                String[] parts = value.split("\\|", 3);
                String key = decrypt(parts[1]);
                JSONObject relay = "relay".equals(kind) && parts.length == 3 ? new JSONObject(decrypt(parts[2])) : null;
                call.resolve(fetchLive(kind, key, relay));
            } catch (Exception e) { call.reject("同步失败：" + safeMessage(e)); }
        }, "quota-refresh").start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        final String kind;
        try { kind = validate(call); } catch (Exception e) { call.reject(e.getMessage()); return; }
        final String id = call.getString("id");
        String value = store().getString(id, "");
        if (value.startsWith(kind + "|")) {store().edit().remove(id).apply();QuotaHomeWidget.refreshAll(getContext());}
        JSObject answer = new JSObject();
        answer.put("success", true);
        call.resolve(answer);
    }

    private static String safeMessage(Exception e) {
        String s = e.getMessage();
        return s == null ? e.getClass().getSimpleName() : s.substring(0, Math.min(180, s.length()));
    }

    private static SecretKey masterKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build());
            generator.generateKey();
        }
        return (SecretKey)store.getKey(ALIAS, null);
    }

    private static String encrypt(String plain) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, masterKey());
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        String payload = Base64.encodeToString(cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        return iv + "." + payload;
    }

    private static String decrypt(String text) throws Exception {
        String[] pair = text.split("\\.", 2);
        if (pair.length != 2) throw new Exception("加密数据已损坏");
        byte[] iv = Base64.decode(pair[0], Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(pair[1], Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private static JSONObject fetchJSON(String endpoint, String key) throws Exception { return fetchJSON(endpoint, key, null); }
    private static JSONObject fetchJSON(String endpoint, String key, String userId) throws Exception {
        URL url = new URL(endpoint);
        if (!"https".equals(url.getProtocol())) throw new Exception("只允许官方 HTTPS 接口");
        HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(12000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Authorization", "Bearer " + key);
        connection.setRequestProperty("Accept", "application/json");
        if (userId != null && !userId.isEmpty()) connection.setRequestProperty("New-Api-User", userId);
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                if (status == 401 || status == 403) throw new Exception("密钥错误或账号权限不足");
                throw new Exception("接口返回 HTTP " + status);
            }
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int n;
                while ((n = in.read(buffer)) > -1) {
                    bytes.write(buffer, 0, n);
                    if (bytes.size() > 1_000_000) throw new Exception("平台响应数据过大");
                }
                return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally { connection.disconnect(); }
    }

    private static JSObject base(String metric, String unit, double value) {
        JSObject result = new JSObject();
        result.put("metric", metric);
        result.put("unit", unit);
        result.put("value", Math.round(value * 10000.0) / 10000.0);
        result.put("updatedAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US) {{
            setTimeZone(TimeZone.getTimeZone("UTC"));
        }}.format(new java.util.Date()));
        return result;
    }

    private static JSObject fetchRelay(String key, JSONObject input) throws Exception {
        if (input == null) throw new Exception("请输入中转站配置");
        String mode = input.optString("mode", "");
        if (!"newapi-account".equals(mode) && !"newapi-key".equals(mode) && !"custom".equals(mode))
            throw new Exception("暂不支持该接口模式");
        URI root = new URI(input.optString("baseUrl", ""));
        if (!"https".equalsIgnoreCase(root.getScheme()) || root.getUserInfo() != null ||
            root.getHost() == null || root.getPort() != -1 && root.getPort() != 443 ||
            root.getRawQuery() != null || root.getRawFragment() != null)
            throw new Exception("中转站仅允许 HTTPS 公网域名");
        String host = root.getHost();
        if (!host.contains(".") || host.equalsIgnoreCase("localhost") ||
            host.startsWith("[") || host.matches("^[0-9.]+$")) throw new Exception("不允许直接连接 IP 或本机");
        for (InetAddress addr : InetAddress.getAllByName(host)) {
            if (addr.isAnyLocalAddress() || addr.isLoopbackAddress() || addr.isSiteLocalAddress() ||
                addr.isLinkLocalAddress() || addr.isMulticastAddress()) throw new Exception("中转站域名解析到私网地址");
        }
        String rootPath = root.getPath().replaceAll("/+$", "").replaceAll("/v1$", "");
        String requestPath = "newapi-account".equals(mode) ? "/api/user/self" :
                "newapi-key".equals(mode) ? "/api/usage/token/" : input.optString("path", "");
        if (!requestPath.matches("^/[a-zA-Z0-9._~/\\-]{1,100}$") || requestPath.contains("..") ||
            requestPath.contains("//")) throw new Exception("非法的余额查询路径");
        String userId = input.optString("userId", "");
        if ("newapi-account".equals(mode) && !userId.matches("^[0-9]{1,12}$"))
            throw new Exception("账户模式需要用户 ID");
        JSONObject response=fetchJSON(root.getScheme()+"://"+host+rootPath+requestPath,key,
                "newapi-account".equals(mode)?userId:null);
        if (response.optBoolean("success", true) == false || response.optBoolean("code", true) == false)
            throw new Exception("中转站返回认证或访问失败");
        JSONObject data=response.optJSONObject("data");
        Object raw=null;
        if ("newapi-account".equals(mode)) raw=data==null?null:data.opt("quota");
        else if ("newapi-key".equals(mode)) {
            if (data != null && data.optBoolean("unlimited_quota", false))
                throw new Exception("此 Key 不限额度，不能转换成有限余额");
            raw=data==null?null:data.opt("total_available");
        } else {
            String field=input.optString("field","data.balance");
            if (!field.matches("^[a-zA-Z_$][a-zA-Z0-9_$]*(\\.[a-zA-Z_$][a-zA-Z0-9_$]*|\\.[0-9]+){0,9}$"))
                throw new Exception("JSON 字段路径不正确");
            Object walk=response;
            for(String segment:field.split("\\.")) {
                if (walk instanceof JSONObject)walk=((JSONObject)walk).opt(segment);
                else if(walk instanceof JSONArray && segment.matches("[0-9]+"))
                    walk=((JSONArray)walk).opt(Integer.parseInt(segment));
                else throw new Exception("JSON 余额字段不存在");
            }
            raw=walk;
        }
        if (raw==null || raw==JSONObject.NULL)throw new Exception("中转站未返回余额数据");
        double remaining=Double.parseDouble(String.valueOf(raw));
        double divisor=input.optDouble("divisor",1);
        if(!Double.isFinite(divisor) || divisor<=0 || divisor>1e12 || !Double.isFinite(remaining))
            throw new Exception("额度数值或换算除数不正确");
        String unit=input.optString("unit","额度点");
        if(unit.length()>16)unit=unit.substring(0,16);
        return base("balance",unit,remaining/divisor);
    }

    private static JSObject fetchLive(String kind, String key) throws Exception { return fetchLive(kind, key, null); }
    private static JSObject fetchLive(String kind, String key, JSONObject relay) throws Exception {
        if ("relay".equals(kind)) return fetchRelay(key, relay);
        if ("deepseek".equals(kind)) {
            JSONObject payload = fetchJSON("https://api.deepseek.com/user/balance", key);
            JSONArray balances = payload.optJSONArray("balance_infos");
            if (balances == null || balances.length() == 0) throw new Exception("未返回余额信息");
            JSONObject selected = balances.optJSONObject(0);
            for (int i = 0; i < balances.length(); i++) {
                JSONObject row = balances.optJSONObject(i);
                if (row != null && "CNY".equals(row.optString("currency"))) { selected = row; break; }
            }
            double balance = Double.parseDouble(selected.optString("total_balance"));
            double bonus = Double.parseDouble(selected.optString("granted_balance", "0"));
            JSObject result = base("balance", selected.optString("currency", "CNY"), balance);
            result.put("bonus", bonus);
            return result;
        }
        if ("openrouter".equals(kind)) {
            JSONObject payload = fetchJSON("https://openrouter.ai/api/v1/credits", key);
            JSONObject values = payload.optJSONObject("data");
            if (values == null || !values.has("total_credits") || !values.has("total_usage")) throw new Exception("额度数据缺失");
            double credits = values.getDouble("total_credits");
            double usage = values.getDouble("total_usage");
            return base("balance", "USD", Math.max(0, credits - usage));
        }

        Calendar startOfMonth = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        startOfMonth.set(Calendar.DAY_OF_MONTH, 1);
        startOfMonth.set(Calendar.HOUR_OF_DAY, 0);
        startOfMonth.set(Calendar.MINUTE, 0);
        startOfMonth.set(Calendar.SECOND, 0);
        startOfMonth.set(Calendar.MILLISECOND, 0);
        long start = startOfMonth.getTimeInMillis() / 1000;
        long end = System.currentTimeMillis() / 1000 + 1;
        String endpoint = "https://api.openai.com/v1/organization/costs?start_time=" + start
                + "&end_time=" + end + "&bucket_width=1d&limit=40";
        JSONObject payload = fetchJSON(endpoint, key);
        JSONArray buckets = payload.optJSONArray("data");
        if (buckets == null) throw new Exception("OpenAI 费用数据缺失");
        double total = 0;
        JSArray daily = new JSArray();
        for (int i = 0; i < buckets.length(); i++) {
            JSONObject bucket = buckets.optJSONObject(i);
            JSONArray costs = bucket == null ? null : bucket.optJSONArray("results");
            double dayTotal = 0;
            if (costs != null) for (int j = 0; j < costs.length(); j++) {
                JSONObject row = costs.optJSONObject(j);
                JSONObject amount = row == null ? null : row.optJSONObject("amount");
                if (amount != null) dayTotal += amount.optDouble("value", 0);
            }
            daily.put(dayTotal);
            total += dayTotal;
        }
        JSObject result = base("spend", "USD", total);
        result.put("daily", daily);
        return result;
    }
}

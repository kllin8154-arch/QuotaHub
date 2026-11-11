package com.aiquotahub.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.util.Map;

public class QuotaHomeWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateWidget(context, manager, id);
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, QuotaHomeWidget.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) updateWidget(context, manager, id);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences("aiquotahub.secrets.v1", Context.MODE_PRIVATE);
        int accounts = 0;
        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String && ((String)value).contains("|")) accounts++;
        }
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.quota_widget);
        views.setTextViewText(R.id.widget_accounts, accounts == 0 ? "尚未绑定账号" : ("已绑定 " + accounts + " 个 API 账号"));
        views.setTextViewText(R.id.widget_status, accounts == 0 ? "点击进入应用绑定" : "点击查看最新额度");
        Intent openApp = new Intent(context, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, widgetId, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pending);
        manager.updateAppWidget(widgetId, views);
    }
}

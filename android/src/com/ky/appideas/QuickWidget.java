package com.ky.appideas;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Home-screen widget. Big button → opens the app on "⚡ Jaldi likho" (quick note),
 * small 📥 button → opens the Inbox. Notes saved there can be moved to any folder later.
 */
public class QuickWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        String pkg = ctx.getPackageName();
        int layout = ctx.getResources().getIdentifier("widget_quick", "layout", pkg);
        int write = ctx.getResources().getIdentifier("widget_write", "id", pkg);
        int inbox = ctx.getResources().getIdentifier("widget_inbox", "id", pkg);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(pkg, layout);
            v.setOnClickPendingIntent(write, open(ctx, "quick", 1));
            v.setOnClickPendingIntent(inbox, open(ctx, "inbox", 2));
            mgr.updateAppWidget(id, v);
        }
    }

    private static PendingIntent open(Context ctx, String page, int requestCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("appideas://open/" + page), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, requestCode, i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}

package com.fitgotchi.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class DispatcherApprovalReceiver extends BroadcastReceiver {
    private static final String TAG = "DispatchApprovalRcv";
    public static final String ACTION_APPROVE_BATCH =
            "com.fitgotchi.app.ACTION_APPROVE_DISPATCH_BATCH";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_APPROVE_BATCH.equals(intent.getAction())) return;

        String batchId = value(intent, CoachDraftMessagingService.EXTRA_BATCH_ID);
        String batchVersion = value(intent, CoachDraftMessagingService.EXTRA_BATCH_VERSION);
        String recipientId = value(intent, CoachDraftMessagingService.EXTRA_RECIPIENT_ID);
        String approvalToken = value(intent, CoachDraftMessagingService.EXTRA_APPROVAL_TOKEN);
        int notificationId = intent.getIntExtra(
                CoachDraftMessagingService.EXTRA_NOTIFICATION_ID, -1);

        if (batchId.isEmpty() || batchVersion.isEmpty() || recipientId.isEmpty()
                || approvalToken.isEmpty() || notificationId < 0) {
            Log.w(TAG, "Ignoring approval tap with missing signed fields");
            return;
        }

        DispatcherApprovalNotifier.showApproving(context, notificationId, batchId, batchVersion);

        Data data = new Data.Builder()
                .putString(DispatcherApprovalWorker.INPUT_BATCH_ID, batchId)
                .putString(DispatcherApprovalWorker.INPUT_BATCH_VERSION, batchVersion)
                .putString(DispatcherApprovalWorker.INPUT_RECIPIENT_ID, recipientId)
                .putString(DispatcherApprovalWorker.INPUT_APPROVAL_TOKEN, approvalToken)
                .putInt(DispatcherApprovalWorker.INPUT_NOTIFICATION_ID, notificationId)
                .build();
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(DispatcherApprovalWorker.class)
                .setInputData(data)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .addTag("dispatcher-approval")
                .build();

        WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
                "dispatcher-approval-" + batchId + "-v" + batchVersion,
                ExistingWorkPolicy.KEEP,
                request);
    }

    private static String value(Intent intent, String key) {
        String value = intent.getStringExtra(key);
        return value == null ? "" : value.trim();
    }
}

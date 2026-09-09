package com.balance.teleprompter;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "RecordingLibrary", permissions = {
    @Permission(alias = "legacyStorage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public class RecordingLibraryPlugin extends Plugin {
    private final ExecutorService writer = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void saveVideo(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "storagePermissionResult");
            return;
        }
        writer.execute(() -> saveRecording(call));
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        if (getPermissionState("legacyStorage") == PermissionState.GRANTED) saveVideo(call);
        else call.reject("Allow storage access to save this video to your gallery.", "PERMISSION_DENIED");
    }

    private void saveRecording(PluginCall call) {
        Uri pending = null;
        File legacyTarget = null;
        ContentResolver resolver = getContext().getContentResolver();
        try {
            String value = call.getString("uri");
            if (value == null) throw new IOException("No recording was supplied.");
            Uri sourceUri = Uri.parse(value);
            if (!"file".equals(sourceUri.getScheme()) || sourceUri.getPath() == null) throw new IOException("Invalid recording location.");
            File source = validateSource(new File(getContext().getCacheDir(), "recordings"), new File(sourceUri.getPath()));
            String mime = source.getName().endsWith(".mp4") ? "video/mp4" : source.getName().endsWith(".webm") ? "video/webm" : null;
            if (mime == null) throw new IOException("Unsupported recording format.");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Video.Media.DISPLAY_NAME, source.getName());
                values.put(MediaStore.Video.Media.MIME_TYPE, mime);
                values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_DCIM + "/Balance Teleprompter");
                values.put(MediaStore.Video.Media.IS_PENDING, 1);
                pending = resolver.insert(MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
                if (pending == null) throw new IOException("Could not create a gallery video.");
                try (OutputStream output = resolver.openOutputStream(pending)) { copy(source, output); }
                values.clear();
                values.put(MediaStore.Video.Media.IS_PENDING, 0);
                if (resolver.update(pending, values, null, null) != 1) throw new IOException("Could not finish saving the video.");
                resolveSaved(call, pending.toString());
            } else {
                File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), "Balance Teleprompter");
                if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Could not create the gallery folder.");
                // Never overwrite another saved take, including after an interrupted retry.
                legacyTarget = File.createTempFile("balance-", source.getName().endsWith(".mp4") ? ".mp4" : ".webm", folder);
                try (OutputStream output = new FileOutputStream(legacyTarget)) { copy(source, output); }
                String savedPath = legacyTarget.getAbsolutePath();
                MediaScannerConnection.scanFile(getContext(), new String[]{savedPath}, new String[]{mime}, (path, uri) -> {
                    resolveSaved(call, uri != null ? uri.toString() : Uri.fromFile(new File(path)).toString());
                });
            }
        } catch (Exception error) {
            if (pending != null) { try { resolver.delete(pending, null, null); } catch (Exception ignored) {} }
            if (legacyTarget != null) legacyTarget.delete();
            call.reject("Video could not be saved. Check free storage and try again. Your original recording is still available.", "SAVE_FAILED", error);
        }
    }

    static File validateSource(File recordings, File candidate) throws IOException {
        File source = candidate.getCanonicalFile();
        String root = recordings.getCanonicalPath() + File.separator;
        if (!source.getPath().startsWith(root) || !source.isFile() || source.length() == 0) {
            throw new IOException("The recording is missing or empty. Please record again.");
        }
        return source;
    }

    static void copy(File source, OutputStream output) throws IOException {
        if (output == null) throw new IOException("Could not open gallery storage.");
        try (FileInputStream input = new FileInputStream(source)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
        output.flush();
    }

    private void resolveSaved(PluginCall call, String uri) {
        JSObject result = new JSObject();
        result.put("uri", uri);
        call.resolve(result);
    }

    @Override protected void handleOnDestroy() { writer.shutdown(); }
}

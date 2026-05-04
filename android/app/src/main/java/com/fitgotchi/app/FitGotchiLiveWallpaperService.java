package com.fitgotchi.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.view.Choreographer;
import android.view.Surface;
import android.view.SurfaceHolder;

import com.google.android.filament.Box;
import com.google.android.filament.Camera;
import com.google.android.filament.Colors;
import com.google.android.filament.EntityManager;
import com.google.android.filament.LightManager;
import com.google.android.filament.MaterialInstance;
import com.google.android.filament.Renderer;
import com.google.android.filament.Scene;
import com.google.android.filament.Skybox;
import com.google.android.filament.SwapChain;
import com.google.android.filament.TransformManager;
import com.google.android.filament.View;
import com.google.android.filament.Viewport;
import com.google.android.filament.gltfio.Animator;
import com.google.android.filament.gltfio.AssetLoader;
import com.google.android.filament.gltfio.FilamentAsset;
import com.google.android.filament.gltfio.MaterialProvider;
import com.google.android.filament.gltfio.ResourceLoader;
import com.google.android.filament.gltfio.UbershaderProvider;
import com.google.android.filament.utils.Utils;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class FitGotchiLiveWallpaperService extends WallpaperService {
    @Override
    public WallpaperService.Engine onCreateEngine() {
        return new CharacterWallpaperEngine(getApplicationContext());
    }

    private final class CharacterWallpaperEngine extends WallpaperService.Engine
            implements Choreographer.FrameCallback, SharedPreferences.OnSharedPreferenceChangeListener {
        private static final long FRAME_INTERVAL_NANOS = 33_333_333L;

        private final Context context;
        private final SharedPreferences prefs;
        private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
        private FilamentWallpaperRenderer renderer;
        private boolean visible;
        private boolean frameScheduled;
        private boolean destroyed;
        private long lastRenderNanos;
        private CharacterLiveWallpaperState.State latestState;

        CharacterWallpaperEngine(Context context) {
            this.context = context.getApplicationContext();
            this.prefs = this.context.getSharedPreferences(
                    CharacterLiveWallpaperState.PREFS_NAME,
                    Context.MODE_PRIVATE);
            this.latestState = CharacterLiveWallpaperState.read(this.context);
            prefs.registerOnSharedPreferenceChangeListener(this);
        }

        @Override
        public void onSurfaceCreated(SurfaceHolder holder) {
            super.onSurfaceCreated(holder);
            Surface surface = holder.getSurface();
            if (surface == null || !surface.isValid()) return;
            renderer = new FilamentWallpaperRenderer(context, ioExecutor);
            renderer.attachSurface(surface);
            renderer.load(latestState);
            maybeStart();
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            super.onSurfaceChanged(holder, format, width, height);
            if (renderer != null) {
                renderer.resize(Math.max(1, width), Math.max(1, height));
            }
        }

        @Override
        public void onVisibilityChanged(boolean visible) {
            this.visible = visible;
            if (visible) maybeStart();
            else stopFrames();
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            stopFrames();
            if (renderer != null) {
                renderer.destroy();
                renderer = null;
            }
            super.onSurfaceDestroyed(holder);
        }

        @Override
        public void onDestroy() {
            destroyed = true;
            stopFrames();
            prefs.unregisterOnSharedPreferenceChangeListener(this);
            if (renderer != null) {
                renderer.destroy();
                renderer = null;
            }
            ioExecutor.shutdownNow();
            super.onDestroy();
        }

        @Override
        public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
            latestState = CharacterLiveWallpaperState.read(context);
            if (renderer != null) {
                renderer.load(latestState);
            }
        }

        @Override
        public void doFrame(long frameTimeNanos) {
            frameScheduled = false;
            if (destroyed || !visible || renderer == null) return;

            if (frameTimeNanos - lastRenderNanos >= FRAME_INTERVAL_NANOS) {
                renderer.render(frameTimeNanos);
                lastRenderNanos = frameTimeNanos;
            }
            scheduleFrame();
        }

        private void maybeStart() {
            if (visible && renderer != null && !destroyed) scheduleFrame();
        }

        private void scheduleFrame() {
            if (frameScheduled) return;
            frameScheduled = true;
            Choreographer.getInstance().postFrameCallback(this);
        }

        private void stopFrames() {
            if (!frameScheduled) return;
            Choreographer.getInstance().removeFrameCallback(this);
            frameScheduled = false;
        }
    }

    private static final class FilamentWallpaperRenderer {
        private final Context context;
        private final ExecutorService ioExecutor;
        private final Handler mainHandler = new Handler(Looper.getMainLooper());
        private final Object loadLock = new Object();

        private com.google.android.filament.Engine engine;
        private Renderer renderer;
        private Scene scene;
        private View view;
        private Camera camera;
        private SwapChain swapChain;
        private Skybox skybox;
        private AssetLoader assetLoader;
        private ResourceLoader resourceLoader;
        private MaterialProvider materialProvider;
        private FilamentAsset asset;
        private Animator animator;
        private int cameraEntity;
        private int keyLightEntity;
        private int fillLightEntity;
        private int width = 1;
        private int height = 1;
        private int idleAnimationIndex = -1;
        private int loadGeneration;
        private long startNanos;
        private String loadedModelSrc = "";
        private CharacterLiveWallpaperState.State activeState;
        private float[] assetCenter = new float[] {0f, 1f, 0f};
        private float[] assetHalfExtent = new float[] {0.5f, 1f, 0.5f};

        FilamentWallpaperRenderer(Context context, ExecutorService ioExecutor) {
            this.context = context.getApplicationContext();
            this.ioExecutor = ioExecutor;
            Utils.init();
        }

        void attachSurface(Surface surface) {
            engine = com.google.android.filament.Engine.create();
            renderer = engine.createRenderer();
            scene = engine.createScene();
            view = engine.createView();
            view.setScene(scene);
            view.setAntiAliasing(View.AntiAliasing.FXAA);
            view.setPostProcessingEnabled(true);

            cameraEntity = EntityManager.get().create();
            camera = engine.createCamera(cameraEntity);
            camera.setExposure(16f, 1f / 125f, 100f);
            view.setCamera(camera);

            Renderer.ClearOptions clearOptions = new Renderer.ClearOptions();
            clearOptions.clear = true;
            clearOptions.clearColor = new float[] {0.015f, 0.025f, 0.045f, 1f};
            renderer.setClearOptions(clearOptions);

            skybox = new Skybox.Builder()
                    .color(0.015f, 0.025f, 0.045f, 1f)
                    .build(engine);
            scene.setSkybox(skybox);

            keyLightEntity = EntityManager.get().create();
            new LightManager.Builder(LightManager.Type.DIRECTIONAL)
                    .color(1.0f, 0.96f, 0.9f)
                    .intensity(95_000f)
                    .direction(-0.35f, -0.9f, -0.28f)
                    .castShadows(false)
                    .build(engine, keyLightEntity);
            scene.addEntity(keyLightEntity);

            fillLightEntity = EntityManager.get().create();
            new LightManager.Builder(LightManager.Type.DIRECTIONAL)
                    .color(0.72f, 0.82f, 1.0f)
                    .intensity(28_000f)
                    .direction(0.55f, -0.45f, 0.65f)
                    .castShadows(false)
                    .build(engine, fillLightEntity);
            scene.addEntity(fillLightEntity);

            materialProvider = new UbershaderProvider(engine);
            assetLoader = new AssetLoader(engine, materialProvider, EntityManager.get());
            resourceLoader = new ResourceLoader(engine, true);
            swapChain = engine.createSwapChain(surface);
            resize(width, height);
        }

        void resize(int width, int height) {
            this.width = Math.max(1, width);
            this.height = Math.max(1, height);
            if (view == null || camera == null) return;
            view.setViewport(new Viewport(0, 0, this.width, this.height));
            double aspect = (double) this.width / (double) this.height;
            camera.setProjection(38.0, aspect, 0.05, 100.0, Camera.Fov.VERTICAL);
            double distance = aspect < 0.75 ? 4.7 : 3.9;
            camera.lookAt(0.0, 1.08, distance, 0.0, 1.02, 0.0, 0.0, 1.0, 0.0);
        }

        void load(CharacterLiveWallpaperState.State state) {
            if (state == null || state.modelSrc == null || state.modelSrc.trim().isEmpty()) return;
            activeState = state;
            if (state.modelSrc.equals(loadedModelSrc) && asset != null) {
                applyMaterialColors(state);
                return;
            }

            final int generation;
            synchronized (loadLock) {
                generation = ++loadGeneration;
            }
            ioExecutor.execute(() -> {
                try {
                    File model = downloadOrGetCachedModel(state.modelSrc);
                    byte[] bytes = readAll(model);
                    mainHandler.post(() -> loadModelOnRenderThread(state, bytes, generation));
                } catch (Exception ignored) {}
            });
        }

        void render(long frameTimeNanos) {
            if (engine == null || renderer == null || view == null || swapChain == null) return;
            if (startNanos == 0L) startNanos = frameTimeNanos;
            float elapsedSeconds = (frameTimeNanos - startNanos) / 1_000_000_000f;

            if (animator != null && idleAnimationIndex >= 0) {
                float duration = Math.max(0.1f, animator.getAnimationDuration(idleAnimationIndex));
                animator.applyAnimation(idleAnimationIndex, elapsedSeconds % duration);
                animator.updateBoneMatrices();
            }

            if (asset != null) {
                float sway = (float) Math.sin(elapsedSeconds * 0.55f) * 0.16f;
                float breathe = 1f + (float) Math.sin(elapsedSeconds * 2.2f) * 0.012f;
                setAssetTransform(sway, breathe);
            }

            if (renderer.beginFrame(swapChain, frameTimeNanos)) {
                renderer.render(view);
                renderer.endFrame();
            }
        }

        void destroy() {
            clearAsset();
            if (engine == null) return;

            if (scene != null) {
                if (keyLightEntity != 0) scene.removeEntity(keyLightEntity);
                if (fillLightEntity != 0) scene.removeEntity(fillLightEntity);
            }
            if (assetLoader != null) assetLoader.destroy();
            if (resourceLoader != null) resourceLoader.destroy();
            if (materialProvider != null) materialProvider.destroy();
            if (skybox != null) engine.destroySkybox(skybox);
            if (swapChain != null) engine.destroySwapChain(swapChain);
            if (view != null) engine.destroyView(view);
            if (scene != null) engine.destroyScene(scene);
            if (renderer != null) engine.destroyRenderer(renderer);
            if (cameraEntity != 0) {
                engine.destroyCameraComponent(cameraEntity);
                EntityManager.get().destroy(cameraEntity);
            }
            if (keyLightEntity != 0) {
                engine.destroyEntity(keyLightEntity);
                EntityManager.get().destroy(keyLightEntity);
            }
            if (fillLightEntity != 0) {
                engine.destroyEntity(fillLightEntity);
                EntityManager.get().destroy(fillLightEntity);
            }
            engine.flushAndWait();
            engine.destroy();

            engine = null;
            renderer = null;
            scene = null;
            view = null;
            camera = null;
            swapChain = null;
            skybox = null;
        }

        private void loadModelOnRenderThread(CharacterLiveWallpaperState.State state, byte[] bytes, int generation) {
            if (engine == null || assetLoader == null || resourceLoader == null) return;
            synchronized (loadLock) {
                if (generation != loadGeneration) return;
            }

            ByteBuffer buffer = ByteBuffer.allocateDirect(bytes.length).order(ByteOrder.nativeOrder());
            buffer.put(bytes);
            buffer.flip();

            FilamentAsset newAsset = assetLoader.createAsset(buffer);
            if (newAsset == null) return;

            clearAsset();
            asset = newAsset;
            resourceLoader.loadResources(asset);
            asset.releaseSourceData();
            scene.addEntities(asset.getEntities());
            loadedModelSrc = state.modelSrc;
            animator = asset.getInstance() != null ? asset.getInstance().getAnimator() : null;
            idleAnimationIndex = findIdleAnimation(animator);

            Box box = asset.getBoundingBox();
            assetCenter = box.getCenter();
            assetHalfExtent = box.getHalfExtent();
            applyMaterialColors(state);
            setAssetTransform(0f, 1f);
        }

        private void clearAsset() {
            if (asset == null || scene == null || assetLoader == null) return;
            scene.removeEntities(asset.getEntities());
            assetLoader.destroyAsset(asset);
            asset = null;
            animator = null;
            idleAnimationIndex = -1;
            loadedModelSrc = "";
        }

        private int findIdleAnimation(Animator animator) {
            if (animator == null || animator.getAnimationCount() <= 0) return -1;
            String[] preferred = new String[] {"idle", "breath", "stand_hands_on_hips", "arms_up_still", "fold_arms", "stand"};
            for (String needle : preferred) {
                for (int i = 0; i < animator.getAnimationCount(); i++) {
                    String name = safeLower(animator.getAnimationName(i));
                    if (name.contains(needle) && !name.contains("pose") && !name.contains("bind")) return i;
                }
            }
            return 0;
        }

        private void setAssetTransform(float angle, float extraScale) {
            if (engine == null || asset == null) return;
            float modelHeight = Math.max(0.1f, assetHalfExtent[1] * 2f);
            float desiredHeight = width > height ? 1.85f : 2.25f;
            float s = desiredHeight / modelHeight * extraScale;
            float c = (float) Math.cos(angle);
            float n = (float) Math.sin(angle);
            float tx = -s * (c * assetCenter[0] + n * assetCenter[2]);
            float ty = -s * (assetCenter[1] - assetHalfExtent[1]);
            float tz = -s * (-n * assetCenter[0] + c * assetCenter[2]);

            float[] transform = new float[] {
                    s * c, 0f, -s * n, 0f,
                    0f, s, 0f, 0f,
                    s * n, 0f, s * c, 0f,
                    tx, ty, tz, 1f
            };
            TransformManager tm = engine.getTransformManager();
            int root = asset.getRoot();
            int instance = tm.getInstance(root);
            if (instance != 0) {
                tm.setTransform(instance, transform);
            }
        }

        private void applyMaterialColors(CharacterLiveWallpaperState.State state) {
            if (asset == null || state == null || state.activeRareSkin != null && !state.activeRareSkin.isEmpty()) {
                return;
            }
            try {
                JSONObject colors = new JSONObject(state.colorsJson);
                MaterialInstance[] materials = asset.getInstance().getMaterialInstances();
                for (MaterialInstance material : materials) {
                    String name = safeLower(material.getName());
                    if (containsAny(name, "hair", "brow", "beard")) {
                        applyBaseColor(material, colors.optString("hair", ""));
                    } else if (containsAny(name, "shirt", "top", "torso", "singlet", "tank")) {
                        applyBaseColor(material, colors.optString("shirt", ""));
                    } else if (containsAny(name, "pants", "short", "trouser", "legging")) {
                        applyBaseColor(material, colors.optString("pants", ""));
                    } else if (containsAny(name, "shoe", "sneaker", "trainer")) {
                        applyBaseColor(material, colors.optString("shoes", ""));
                    } else if (containsAny(name, "skin", "body", "face", "head", "arm", "hand", "leg")) {
                        applyBaseColor(material, colors.optString("skin", ""));
                    }
                }
            } catch (Exception ignored) {}
        }

        private void applyBaseColor(MaterialInstance material, String hex) {
            int color = parseHexColor(hex);
            if (color == 0) return;
            float r = ((color >> 16) & 0xff) / 255f;
            float g = ((color >> 8) & 0xff) / 255f;
            float b = (color & 0xff) / 255f;
            try {
                material.setParameter("baseColorFactor", Colors.RgbaType.SRGB, r, g, b, 1f);
            } catch (Exception ignored) {}
        }

        private File downloadOrGetCachedModel(String modelSrc) throws Exception {
            File dir = new File(context.getCacheDir(), "wallpaper_models");
            if (!dir.exists() && !dir.mkdirs()) throw new java.io.IOException("Could not create model cache");
            File file = new File(dir, sha256(modelSrc) + ".glb");
            if (file.exists() && file.length() > 1024) return file;

            HttpURLConnection connection = (HttpURLConnection) new URL(modelSrc).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            try {
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new java.io.IOException("HTTP " + status);
                }
                try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream output = new FileOutputStream(file)) {
                    byte[] buffer = new byte[16 * 1024];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                    }
                }
            } finally {
                connection.disconnect();
            }
            return file;
        }

        private byte[] readAll(File file) throws Exception {
            try (FileInputStream input = new FileInputStream(file);
                 ByteArrayOutputStream output = new ByteArrayOutputStream((int) Math.min(file.length(), Integer.MAX_VALUE))) {
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                return output.toByteArray();
            }
        }

        private String sha256(String value) throws Exception {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) builder.append(String.format(Locale.US, "%02x", b));
            return builder.toString();
        }

        private boolean containsAny(String value, String... needles) {
            for (String needle : needles) {
                if (value.contains(needle)) return true;
            }
            return false;
        }

        private String safeLower(String value) {
            return value == null ? "" : value.toLowerCase(Locale.US);
        }

        private int parseHexColor(String hex) {
            if (hex == null) return 0;
            String clean = hex.trim();
            if (clean.startsWith("#")) clean = clean.substring(1);
            if (clean.length() != 6) return 0;
            try {
                return Integer.parseInt(clean, 16);
            } catch (Exception ignored) {
                return 0;
            }
        }
    }
}

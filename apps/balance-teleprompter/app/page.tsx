'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { initialisePurchases, purchaseLifetimeAccess, restoreLifetimeAccess } from '../lib/purchases';

const starterScript = `Take a breath. Look into the lens. You’ve got this.

Paste your script here, then press Start. Your words will glide beside the camera so your eyes stay naturally connected with your audience.

Speak a little slower than feels natural. Pause between ideas. And remember: the best delivery sounds like you — not like you’re reading.`;

type CameraState = 'off' | 'starting' | 'ready' | 'error';
type VideoQuality = '720p' | '1080p' | '4k';

const QUALITY_SETTINGS: Record<VideoQuality, { width: number; height: number; videoBitsPerSecond: number }> = {
  '720p': { width: 1280, height: 720, videoBitsPerSecond: 5_000_000 },
  '1080p': { width: 1920, height: 1080, videoBitsPerSecond: 10_000_000 },
  '4k': { width: 3840, height: 2160, videoBitsPerSecond: 20_000_000 },
};

function promptPixelsPerSecond(speed: number) {
  return 2 + Math.pow(speed / 100, 2) * 118;
}

function createRecordingFilename(extension: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `balance-teleprompter-${timestamp}.${extension}`;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const nativeWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cameraWantedRef = useRef(false);
  const cameraRequestRef = useRef(0);
  const cameraRecoveringRef = useRef(false);
  const resumeCameraAfterBackgroundRef = useRef(false);
  const videoHealthFailuresRef = useRef(0);
  const isRecordingRef = useRef(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);

  const [script, setScript] = useState(starterScript);
  const [speed, setSpeed] = useState(32);
  const [fontSize, setFontSize] = useState(46);
  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isPrompting, setIsPrompting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [nativeRecordingUri, setNativeRecordingUri] = useState('');
  const [recordingExtension, setRecordingExtension] = useState('webm');
  const [recordingFilename, setRecordingFilename] = useState('');
  const [mirrorText, setMirrorText] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [showPromptText, setShowPromptText] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(3);
  const [supportsNativeZoom, setSupportsNativeZoom] = useState(false);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('1080p');
  const [usedRecordings, setUsedRecordings] = useState(0);
  const [lifetimeUnlocked, setLifetimeUnlocked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isNativeStore, setIsNativeStore] = useState(() => Capacitor.isNativePlatform());
  const [storeConfigured, setStoreConfigured] = useState(false);
  const [lifetimePrice, setLifetimePrice] = useState('$9.99 AUD');
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.ceil((wordCount / 130) * 60);
  const freeRecordingsLeft = Math.max(0, 3 - usedRecordings);

  useEffect(() => {
    let cancelled = false;
    const saved = window.localStorage.getItem('sightline-script');
    const savedSpeed = Number(window.localStorage.getItem('sightline-speed'));
    const savedSize = Number(window.localStorage.getItem('sightline-font-size'));
    const savedUses = Number(window.localStorage.getItem('balance-teleprompter-recordings'));
    const savedLifetime = window.localStorage.getItem('balance-teleprompter-lifetime') === 'true';

    window.queueMicrotask(() => {
      if (cancelled) return;
      if (saved) setScript(saved);
      if (savedSpeed >= 1 && savedSpeed <= 100) setSpeed(savedSpeed);
      if (savedSize >= 28 && savedSize <= 72) setFontSize(savedSize);
      if (Number.isFinite(savedUses) && savedUses > 0) setUsedRecordings(savedUses);
      if (savedLifetime) setLifetimeUnlocked(true);
    });

    initialisePurchases()
      .then((status) => {
        if (cancelled) return;
        setIsNativeStore(status.native);
        setStoreConfigured(status.configured);
        setLifetimePrice(status.price);
        if (status.unlocked) {
          setLifetimeUnlocked(true);
          window.localStorage.setItem('balance-teleprompter-lifetime', 'true');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sightline-script', script);
  }, [script]);

  useEffect(() => {
    window.localStorage.setItem('sightline-speed', String(speed));
    window.localStorage.setItem('sightline-font-size', String(fontSize));
  }, [speed, fontSize]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const stopCamera = useCallback(() => {
    cameraWantedRef.current = false;
    resumeCameraAfterBackgroundRef.current = false;
    videoHealthFailuresRef.current = 0;
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('off');
  }, []);

  const startCamera = useCallback(async (
    mode: 'user' | 'environment' = facingMode,
    selectedQuality: VideoQuality = videoQuality,
  ) => {
    cameraWantedRef.current = true;
    const requestId = ++cameraRequestRef.current;
    let timedOut = false;
    let pendingStream: MediaStream | null = null;
    let startTimeout: number | undefined;
    setCameraState('starting');
    setCameraError('');
    const previousStream = streamRef.current;
    if (videoRef.current) videoRef.current.srcObject = null;
    previousStream?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (previousStream) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      if (!cameraWantedRef.current || requestId !== cameraRequestRef.current) return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera access is unavailable.', 'NotSupportedError');
      const quality = QUALITY_SETTINGS[selectedQuality];
      const mediaRequest = navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: quality.width }, height: { ideal: quality.height } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaRequest.then((stream) => {
        pendingStream = stream;
        if (timedOut || !cameraWantedRef.current || requestId !== cameraRequestRef.current) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }).catch(() => undefined);
      const stream = await Promise.race([
        mediaRequest,
        new Promise<never>((_, reject) => { startTimeout = window.setTimeout(() => {
          timedOut = true;
          reject(new DOMException('Camera start timed out.', 'TimeoutError'));
        }, 8000); }),
      ]);
      window.clearTimeout(startTimeout);
      if (!cameraWantedRef.current || requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = typeof videoTrack?.getCapabilities === 'function'
        ? videoTrack.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } }
        : undefined;
      if (capabilities?.zoom) {
        setSupportsNativeZoom(true);
        setCameraZoom(capabilities.zoom.min || 1);
        setZoomMax(Math.min(capabilities.zoom.max, 5));
      } else {
        setSupportsNativeZoom(false);
        setCameraZoom(1);
        setZoomMax(3);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        let previewTimeout: number | undefined;
        try {
          await Promise.race([
            videoRef.current.play(),
            new Promise<never>((_, reject) => { previewTimeout = window.setTimeout(() => {
              timedOut = true;
              reject(new DOMException('Camera preview timed out.', 'TimeoutError'));
            }, 5000); }),
          ]);
        } finally {
          window.clearTimeout(previewTimeout);
        }
      }
      videoHealthFailuresRef.current = 0;
      setCameraState('ready');
    } catch (error) {
      window.clearTimeout(startTimeout);
      if (!cameraWantedRef.current || requestId !== cameraRequestRef.current) return;
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === pendingStream) streamRef.current = null;
      if (videoRef.current?.srcObject === pendingStream) videoRef.current.srcObject = null;

      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow camera and microphone access, then try again.'
        : error instanceof DOMException && error.name === 'TimeoutError'
          ? 'The camera took too long to respond. Close any other camera app, then tap Try camera again.'
          : error instanceof DOMException && error.name === 'NotSupportedError'
            ? 'This browser cannot access the camera. Open the secure app link in Safari or Chrome.'
            : 'I couldn’t start the camera. Check that it isn’t being used by another app.';
      setCameraError(message);
      setCameraState('error');
    }
  }, [facingMode, videoQuality]);

  useEffect(() => () => {
    cameraWantedRef.current = false;
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  const recoverCamera = useCallback(async (forceRestart = false) => {
    if (!cameraWantedRef.current || cameraRecoveringRef.current || isRecordingRef.current || document.visibilityState === 'hidden') return;
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    const video = videoRef.current;

    if (!forceRestart && stream && track?.readyState === 'live' && !track.muted && video) {
      if (video.srcObject !== stream) video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        videoHealthFailuresRef.current = 0;
        return;
      }
      videoHealthFailuresRef.current += 1;
      if (videoHealthFailuresRef.current < 2) return;
    }

    videoHealthFailuresRef.current = 0;
    cameraRecoveringRef.current = true;
    try {
      await startCamera(facingMode, videoQuality);
    } finally {
      cameraRecoveringRef.current = false;
    }
  }, [facingMode, startCamera, videoQuality]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!cameraWantedRef.current || isRecordingRef.current) return;
        resumeCameraAfterBackgroundRef.current = true;
        cameraRequestRef.current += 1;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraState('off');
        return;
      }

      if (resumeCameraAfterBackgroundRef.current) {
        resumeCameraAfterBackgroundRef.current = false;
        window.setTimeout(() => void startCamera(facingMode, videoQuality), 350);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [facingMode, startCamera, videoQuality]);

  useEffect(() => {
    if (cameraState !== 'ready') return;
    const track = streamRef.current?.getVideoTracks()[0];
    let interruptionTimer: number | undefined;

    const handlePageShow = () => window.setTimeout(() => void recoverCamera(false), 200);
    const handleTrackInterrupted = () => {
      window.clearTimeout(interruptionTimer);
      interruptionTimer = window.setTimeout(() => void recoverCamera(true), 500);
    };
    const watchdog = window.setInterval(() => void recoverCamera(false), 4000);

    window.addEventListener('pageshow', handlePageShow);
    track?.addEventListener('ended', handleTrackInterrupted);
    track?.addEventListener('mute', handleTrackInterrupted);
    return () => {
      window.clearInterval(watchdog);
      window.clearTimeout(interruptionTimer);
      window.removeEventListener('pageshow', handlePageShow);
      track?.removeEventListener('ended', handleTrackInterrupted);
      track?.removeEventListener('mute', handleTrackInterrupted);
    };
  }, [cameraState, recoverCamera]);

  useEffect(() => {
    if (!isPrompting) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    const tick = (time: number) => {
      if (lastFrameRef.current !== null && promptRef.current) {
        const delta = (time - lastFrameRef.current) / 1000;
        scrollPositionRef.current += promptPixelsPerSecond(speed) * delta;
        promptRef.current.scrollTop = scrollPositionRef.current;
        const atEnd = promptRef.current.scrollTop + promptRef.current.clientHeight >= promptRef.current.scrollHeight - 2;
        if (atEnd) {
          setIsPrompting(false);
          return;
        }
      }
      lastFrameRef.current = time;
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPrompting, speed]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  const togglePrompt = useCallback(() => {
    if (!script.trim()) return;
    if (promptRef.current && promptRef.current.scrollTop + promptRef.current.clientHeight >= promptRef.current.scrollHeight - 2) {
      promptRef.current.scrollTop = 0;
    }
    setIsPrompting((value) => {
      if (!value) {
        scrollPositionRef.current = promptRef.current?.scrollTop ?? 0;
        setShowPromptText(true);
      }
      return !value;
    });
  }, [script]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') return;
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl('');
    }
    setNativeRecordingUri('');
    const mimeType = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: QUALITY_SETTINGS[videoQuality].videoBitsPerSecond,
      audioBitsPerSecond: 128_000,
    });
    const nativeRecording = Capacitor.isNativePlatform();
    const extension = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const filename = createRecordingFilename(extension);
    const nativePath = `recordings/${filename}`;
    chunksRef.current = [];
    if (nativeRecording) {
      nativeWriteQueueRef.current = Filesystem.writeFile({
        path: nativePath,
        data: '',
        directory: Directory.Cache,
        recursive: true,
      }).then(() => undefined);
    }
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      if (nativeRecording) {
        nativeWriteQueueRef.current = nativeWriteQueueRef.current.then(async () => {
          const data = await blobToBase64(event.data);
          await Filesystem.appendFile({ path: nativePath, data, directory: Directory.Cache });
        });
      } else {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = async () => {
      setRecordingExtension(extension);
      setRecordingFilename(filename);
      if (nativeRecording) {
        await nativeWriteQueueRef.current;
        const { uri } = await Filesystem.getUri({ path: nativePath, directory: Directory.Cache });
        setNativeRecordingUri(uri);
      } else {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        setRecordingUrl(URL.createObjectURL(blob));
      }
      if (isNativeStore && !lifetimeUnlocked) {
        setUsedRecordings((current) => {
          const next = Math.min(3, current + 1);
          window.localStorage.setItem('balance-teleprompter-recordings', String(next));
          return next;
        });
      }
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecordingSeconds(0);
    setIsRecording(true);
    if (!isPrompting) {
      scrollPositionRef.current = promptRef.current?.scrollTop ?? 0;
      setIsPrompting(true);
    }
  }, [isNativeStore, isPrompting, lifetimeUnlocked, recordingUrl, videoQuality]);

  const startCountdown = async () => {
    if (isNativeStore && !lifetimeUnlocked && freeRecordingsLeft <= 0) {
      setShowPaywall(true);
      return;
    }
    if (cameraState !== 'ready') await startCamera();
    if (!streamRef.current) return;
    for (let number = 3; number >= 1; number -= 1) {
      setCountdown(number);
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    }
    setCountdown(null);
    beginRecording();
  };

  const unlockLifetime = async () => {
    if (!isNativeStore || !storeConfigured) {
      setPurchaseMessage('Lifetime access will be available inside the App Store and Google Play version.');
      return;
    }
    setPurchaseBusy(true);
    setPurchaseMessage('');
    try {
      const unlocked = await purchaseLifetimeAccess();
      if (unlocked) {
        setLifetimeUnlocked(true);
        window.localStorage.setItem('balance-teleprompter-lifetime', 'true');
        setShowPaywall(false);
      }
    } catch (error) {
      const cancelled = error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled;
      if (!cancelled) setPurchaseMessage('The purchase could not be completed. Please try again.');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const restorePurchase = async () => {
    if (!isNativeStore || !storeConfigured) {
      setPurchaseMessage('Restore purchases will be available in the installed app.');
      return;
    }
    setPurchaseBusy(true);
    setPurchaseMessage('');
    try {
      const unlocked = await restoreLifetimeAccess();
      if (unlocked) {
        setLifetimeUnlocked(true);
        window.localStorage.setItem('balance-teleprompter-lifetime', 'true');
        setShowPaywall(false);
      } else {
        setPurchaseMessage('No previous lifetime purchase was found.');
      }
    } catch {
      setPurchaseMessage('Purchases could not be restored. Please try again.');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const shareNativeRecording = async () => {
    if (!nativeRecordingUri) return;
    await Share.share({
      title: 'Balance Teleprompter recording',
      text: 'Recorded with Balance Teleprompter',
      url: nativeRecordingUri,
      dialogTitle: 'Save or share your recording',
    });
  };

  const flipCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (cameraState === 'ready') await startCamera(nextMode);
  };

  const updateZoom = async (value: number) => {
    const nextZoom = Math.max(1, Math.min(zoomMax, Number(value.toFixed(1))));
    setCameraZoom(nextZoom);
    if (!supportsNativeZoom) return;
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    await videoTrack.applyConstraints({ advanced: [{ zoom: nextZoom } as MediaTrackConstraintSet] }).catch(() => undefined);
  };

  const changeVideoQuality = async (quality: VideoQuality) => {
    setVideoQuality(quality);
    if (cameraState === 'ready' && !isRecording) await startCamera(facingMode, quality);
  };

  const resetPrompt = () => {
    setIsPrompting(false);
    scrollPositionRef.current = 0;
    if (promptRef.current) promptRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFullscreen = () => {
    setIsAppFullscreen((value) => !value);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePrompt();
      }
      if (event.code === 'Escape' && isRecording) stopRecording();
      else if (event.code === 'Escape' && isAppFullscreen) setIsAppFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAppFullscreen, isRecording, stopRecording, togglePrompt]);

  return (
    <main className="min-h-screen bg-[#F8F5EE] text-[#151515]">
      <header className={`${isAppFullscreen ? 'hidden' : 'flex'} mx-auto max-w-[1600px] items-center justify-between px-4 py-3 sm:px-7 sm:py-4`}>
        <div className="flex items-center gap-3">
          <img src="/balance-logo.png" alt="Balance" className="h-10 w-10 rounded-full border border-[#DED7C9] object-cover" />
          <div>
            <p className="font-semibold tracking-tight">Balance Teleprompter</p>
            <p className="text-[11px] text-[#6F6A61]">Speak naturally. Stay connected.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-[#6F6A61] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D8B25E]" /> Private on this device
          </span>
          <a href={isNativeStore ? './privacy.html' : '/privacy'} className="hidden rounded-full px-2 py-2 text-xs text-[#6F6A61] transition hover:text-[#151515] sm:block">Privacy</a>
          <button onClick={() => setShowGuide(true)} className="rounded-full border border-[#DED7C9] px-3.5 py-2 text-xs text-[#6F6A61] transition hover:border-[#D8B25E] hover:text-[#151515]">How it works</button>
        </div>
      </header>

      <section className={`${isAppFullscreen ? 'block p-0' : 'mx-auto grid max-w-[1600px] gap-4 px-3 pb-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-5'}`}>
        <div className={`${isAppFullscreen ? 'fixed inset-0 z-40 min-h-screen rounded-none border-0' : 'relative min-h-[68vh] rounded-[28px] border border-[#111111]/15 lg:min-h-[calc(100vh-92px)]'} overflow-hidden bg-[#111111] text-white shadow-[0_24px_70px_rgba(21,21,21,.18)]`}>
          <video
            ref={videoRef}
            muted
            playsInline
            onStalled={() => void recoverCamera(false)}
            onError={() => void recoverCamera(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300 ${cameraState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            style={{ transform: `scale(${supportsNativeZoom ? 1 : cameraZoom}) scaleX(${facingMode === 'user' ? -1 : 1})` }}
          />
          <div className={`absolute inset-0 bg-[#111111] transition-opacity ${cameraState === 'ready' ? 'opacity-0' : 'opacity-100'}`} />
          <div className="pointer-events-none absolute inset-0 bg-black/20" />

          {isAppFullscreen && (
            <button
              onClick={toggleFullscreen}
              aria-label="Exit full screen"
              className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-30 rounded-full border border-white/20 bg-black/65 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-xl hover:border-[#D8B25E]"
            >
              ← Exit full screen
            </button>
          )}

          <div className={`absolute left-4 flex items-center gap-2 sm:left-5 ${isAppFullscreen ? 'top-[calc(env(safe-area-inset-top)+4.75rem)]' : 'top-4 sm:top-5'}`}>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-medium text-white/65 backdrop-blur-xl">
              {cameraState === 'ready' ? '● Camera ready' : cameraState === 'starting' ? 'Starting camera…' : 'Camera preview'}
            </span>
            {isRecording && <span className="rounded-full bg-red-500/90 px-3 py-1.5 text-[11px] font-semibold shadow-lg">● REC {formatTime(recordingSeconds)}</span>}
          </div>

          {cameraState === 'ready' && (
            <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-2 py-1.5 text-white backdrop-blur-xl">
                <button onClick={() => updateZoom(cameraZoom - 0.1)} className="grid h-7 w-7 place-items-center rounded-full text-lg text-white/65 hover:bg-white/10 hover:text-white" aria-label="Zoom out">−</button>
                <input aria-label="Camera zoom" type="range" min="1" max={zoomMax} step="0.1" value={cameraZoom} onChange={(event) => updateZoom(Number(event.target.value))} className="!w-24 accent-[#D8B25E] sm:!w-32" />
                <button onClick={() => updateZoom(cameraZoom + 0.1)} className="grid h-7 w-7 place-items-center rounded-full text-lg text-white/65 hover:bg-white/10 hover:text-white" aria-label="Zoom in">+</button>
                <span className="w-8 text-right text-[11px] font-semibold text-white/65">{cameraZoom.toFixed(1)}×</span>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[11px] text-white/65 backdrop-blur-xl">
                <span>Quality</span>
                <select aria-label="Recording quality" value={videoQuality} onChange={(event) => changeVideoQuality(event.target.value as VideoQuality)} disabled={isRecording} className="bg-transparent font-semibold text-white outline-none">
                  <option value="720p" className="bg-[#111111]">HD 720p</option>
                  <option value="1080p" className="bg-[#111111]">Full HD 1080p</option>
                  <option value="4k" className="bg-[#111111]">Ultra HD 4K</option>
                </select>
              </label>
              <button onClick={() => setShowPromptText((value) => !value)} className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[11px] font-semibold text-white/70 backdrop-blur-xl hover:border-[#D8B25E]/60 hover:text-white">
                {showPromptText ? 'Hide script' : 'Show script'}
              </button>
            </div>
          )}

          {cameraState !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div className="max-w-md">
                <img src="/balance-logo.png" alt="" className="mx-auto mb-5 h-16 w-16 rounded-full border border-white/15 object-cover" />
                <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Stay on script.<br /><span className="text-[#F5D98A]">Stay on camera.</span></h1>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-white/48">Your script sits close to the lens, so you sound natural and keep eye contact.</p>
                <button onClick={() => startCamera()} disabled={cameraState === 'starting'} className="mt-7 rounded-full bg-[#D8B25E] px-6 py-3.5 font-semibold text-[#111111] transition hover:bg-[#F5D98A] disabled:opacity-50">
                  {cameraState === 'starting' ? 'Starting…' : cameraState === 'error' ? 'Try camera again' : 'Enable camera & mic'}
                </button>
                {cameraError && <p role="alert" className="mt-4 text-sm text-amber-200">{cameraError}</p>}
              </div>
            </div>
          )}

          {cameraState === 'ready' && showPromptText && (
            <div className="absolute inset-x-0 top-[7%] mx-auto w-[min(900px,92%)]">
              <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#F5D98A]">
                <span className="h-px w-12 bg-[#D8B25E]" /> Lens line <span className="h-px w-12 bg-[#D8B25E]" />
              </div>
              <div
                ref={promptRef}
                aria-label="Scrolling teleprompter"
                className="teleprompter-scroll relative mx-auto h-[46vh] max-h-[520px] overflow-y-auto rounded-[24px] border border-white/[.07] bg-black/45 px-5 py-[18vh] text-center shadow-[0_20px_70px_rgba(0,0,0,.3)] backdrop-blur-md sm:px-10"
                style={{ transform: mirrorText ? 'scaleX(-1)' : undefined }}
              >
                <p className="whitespace-pre-wrap font-semibold leading-[1.28] tracking-[-0.035em] text-white [text-shadow:0_2px_16px_rgba(0,0,0,.9)]" style={{ fontSize: `clamp(28px, ${fontSize / 12}vw, ${fontSize}px)` }}>
                  {script || 'Paste your script in the panel to begin.'}
                </p>
              </div>
            </div>
          )}

          {countdown !== null && <div className="absolute inset-0 grid place-items-center bg-black/45 text-[9rem] font-black text-[#F5D98A] backdrop-blur-sm">{countdown}</div>}

          <div className={`absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 border-t border-white/5 bg-black/55 px-4 pt-4 backdrop-blur-sm sm:px-6 sm:pt-5 ${isAppFullscreen ? 'pb-[calc(env(safe-area-inset-bottom)+1rem)]' : 'pb-4 sm:pb-6'}`}>
            <div className="flex gap-2">
              <button onClick={flipCamera} disabled={isRecording} className="control-button" aria-label="Flip camera">Flip</button>
              {!isAppFullscreen && <button onClick={toggleFullscreen} className="control-button" aria-label="Enter full screen">Full screen</button>}
            </div>

            {cameraState === 'ready' && (
              <button
                onClick={isRecording ? stopRecording : startCountdown}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-[3px] transition sm:h-[72px] sm:w-[72px] ${isAppFullscreen ? 'fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-50 -translate-x-1/2 shadow-2xl' : ''} ${isRecording ? 'border-red-400 bg-red-500' : 'border-white bg-white/10 hover:scale-105'}`}
              >
                <span className={`${isRecording ? 'h-6 w-6 rounded-md bg-white' : 'h-12 w-12 rounded-full bg-red-500 sm:h-14 sm:w-14'}`} />
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={() => setMirrorText((value) => !value)} className={`control-button ${mirrorText ? '!border-[#D8B25E] !text-[#F5D98A]' : ''}`}>Mirror text</button>
              <button onClick={stopCamera} disabled={isRecording || cameraState !== 'ready'} className="control-button">Camera off</button>
            </div>
          </div>
        </div>

        <aside className={`${isAppFullscreen ? 'hidden' : 'flex'} min-h-[620px] flex-col rounded-[28px] border border-[#DED7C9] bg-white p-5 text-[#151515] lg:min-h-0`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex bg-[#D8B25E] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#111111]">Your script</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Ready when you are</h2>
            </div>
            <span className="shrink-0 rounded-full bg-[#F4F0E7] px-2.5 py-1 text-[11px] text-[#6F6A61]">{wordCount} words · {formatTime(estimatedSeconds)}</span>
          </div>

          {isNativeStore ? (
            <button onClick={() => setShowPaywall(true)} className="mt-4 flex items-center justify-between rounded-xl border border-[#DED7C9] bg-[#F8F5EE] px-3 py-2 text-left text-[11px] text-[#6F6A61] transition hover:border-[#D8B25E]">
              <span>{lifetimeUnlocked ? 'Lifetime access unlocked' : `${freeRecordingsLeft} free recording${freeRecordingsLeft === 1 ? '' : 's'} left`}</span>
              <span className="font-semibold text-[#151515]">{lifetimeUnlocked ? 'Yours forever' : `${lifetimePrice} lifetime`}</span>
            </button>
          ) : (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D8B25E]/60 bg-[#F8F5EE] px-3 py-2 text-[11px] text-[#6F6A61]">
              <span>Balance member access</span>
              <span className="font-semibold text-[#151515]">Unlimited uses</span>
            </div>
          )}

          <textarea
            aria-label="Teleprompter script"
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck
            className="mt-5 min-h-56 flex-1 resize-none rounded-2xl border border-[#DED7C9] bg-[#F8F5EE] p-4 text-[15px] leading-7 text-[#151515] outline-none transition placeholder:text-[#6F6A61]/60 focus:border-[#D8B25E]"
            placeholder="Paste or type your script here…"
          />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-[#DED7C9] bg-[#F8F5EE] px-4 py-3 text-sm text-[#6F6A61]">
              <span className="flex justify-between"><span>Scroll speed</span><span className="font-semibold text-[#151515]">{speed}</span></span>
              <input aria-label="Scroll speed" type="range" min="1" max="100" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="settings-slider" />
            </label>
            <label className="rounded-2xl border border-[#DED7C9] bg-[#F8F5EE] px-4 py-3 text-sm text-[#6F6A61]">
              <span className="flex justify-between"><span>Text size</span><span className="font-semibold text-[#151515]">{fontSize}</span></span>
              <input aria-label="Text size" type="range" min="28" max="72" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} className="settings-slider" />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={togglePrompt} disabled={!script.trim()} className={`rounded-2xl px-4 py-3.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${isPrompting ? 'bg-[#D8B25E] text-[#111111] hover:bg-[#F5D98A]' : 'bg-[#111111] text-white hover:bg-[#2a2a2a]'}`}>
              {isPrompting ? 'Pause prompt' : 'Start prompting'}
            </button>
            <button onClick={resetPrompt} className="rounded-2xl border border-[#DED7C9] px-4 text-sm text-[#6F6A61] transition hover:border-[#D8B25E] hover:text-[#151515]">Reset</button>
          </div>

          {nativeRecordingUri ? (
            <button onClick={shareNativeRecording} className="mt-3 w-full rounded-2xl border border-[#D8B25E] bg-[#F8F5EE] px-4 py-3 text-center text-sm font-semibold text-[#151515] transition hover:bg-[#F4F0E7]">
              Save or share your recording
            </button>
          ) : recordingUrl ? (
            <a href={recordingUrl} download={recordingFilename || createRecordingFilename(recordingExtension)} className="mt-3 block rounded-2xl border border-[#D8B25E] bg-[#F8F5EE] px-4 py-3 text-center text-sm font-semibold text-[#151515] transition hover:bg-[#F4F0E7]">
              Download your recording
            </a>
          ) : (
            <p className="mt-4 text-center text-[11px] leading-5 text-[#6F6A61]">Space pauses the prompt · Esc stops recording<br />Your script and video stay on this device.</p>
          )}
        </aside>
      </section>

      {showGuide && (
        <div role="dialog" aria-modal="true" aria-label="How Balance Teleprompter works" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowGuide(false); }}>
          <div className="w-full max-w-md rounded-[28px] border border-[#DED7C9] bg-[#F8F5EE] p-6 text-[#151515] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="inline-flex bg-[#D8B25E] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#111111]">Quick start</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Three steps. That’s it.</h2></div>
              <button onClick={() => setShowGuide(false)} className="grid h-9 w-9 place-items-center rounded-full bg-[#F4F0E7] text-[#6F6A61] hover:bg-[#E7E0D2]" aria-label="Close guide">×</button>
            </div>
            <ol className="mt-6 space-y-4">
              {[
                ['1', 'Paste your words', 'Add your script, then tune the speed and text size.'],
                ['2', 'Enable your camera', 'Allow camera and microphone access when your browser asks.'],
                ['3', 'Record with confidence', 'Press the red button. The prompt starts after a short countdown.'],
              ].map(([number, title, body]) => (
                <li key={number} className="flex gap-4 rounded-2xl border border-[#DED7C9] bg-white p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#D8B25E] font-bold text-[#111111]">{number}</span>
                  <div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-5 text-[#6F6A61]">{body}</p></div>
                </li>
              ))}
            </ol>
            <button onClick={() => setShowGuide(false)} className="mt-5 w-full rounded-2xl bg-[#111111] py-3.5 font-semibold text-white">Got it</button>
          </div>
        </div>
      )}

      {showPaywall && (
        <div role="dialog" aria-modal="true" aria-label="Lifetime access" className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowPaywall(false); }}>
          <div className="w-full max-w-md rounded-[28px] border border-[#DED7C9] bg-[#F8F5EE] p-6 text-[#151515] shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <img src="/balance-logo.png" alt="Balance" className="h-14 w-14 rounded-full border border-[#DED7C9] object-cover" />
              <button onClick={() => setShowPaywall(false)} className="grid h-9 w-9 place-items-center rounded-full bg-[#F4F0E7] text-[#6F6A61] hover:bg-[#E7E0D2]" aria-label="Close lifetime access">×</button>
            </div>
            <p className="mt-6 inline-flex bg-[#D8B25E] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#111111]">One payment. No subscription.</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Keep creating, forever.</h2>
            <p className="mt-3 text-sm leading-6 text-[#6F6A61]">Your first three recordings are free. Unlock unlimited scripts, recordings, 4K quality, zoom controls, and every future update.</p>
            <div className="mt-5 flex items-end justify-between border-y border-[#DED7C9] py-4">
              <span className="text-sm text-[#6F6A61]">Lifetime access</span>
              <span className="text-2xl font-semibold">{lifetimePrice}</span>
            </div>
            <button onClick={unlockLifetime} disabled={purchaseBusy || lifetimeUnlocked} className="mt-5 w-full rounded-2xl bg-[#111111] py-3.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:opacity-50">
              {lifetimeUnlocked ? 'Lifetime access unlocked' : purchaseBusy ? 'Connecting to store…' : `Unlock for ${lifetimePrice}`}
            </button>
            <button onClick={restorePurchase} disabled={purchaseBusy} className="mt-2 w-full py-2 text-sm font-medium text-[#6F6A61] hover:text-[#151515]">Restore purchase</button>
            {purchaseMessage && <p role="status" className="mt-2 text-center text-xs leading-5 text-[#6F6A61]">{purchaseMessage}</p>}
            <p className="mt-3 text-center text-[10px] leading-4 text-[#6F6A61]">One-time, non-consumable purchase. Price is shown by your local app store before payment.</p>
          </div>
        </div>
      )}
    </main>
  );
}

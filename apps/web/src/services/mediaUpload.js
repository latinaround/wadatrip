import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const fallbackConfig = {
  apiKey: 'AIzaSyDLET2NxvDDnw5AqP9Ton1WVo1tSt0U8XA',
  authDomain: 'wadatrip-nuevo.firebaseapp.com',
  projectId: 'wadatrip-nuevo',
  storageBucket: 'wadatrip-nuevo.firebasestorage.app',
  messagingSenderId: '981114942208',
  appId: '1:981114942208:web:5cf9e5f1f4d0a1f9000000',
};

function resolveFirebaseAppId() {
  const envAppId = String(import.meta.env.VITE_FB_APP_ID || '').trim();
  if (envAppId.includes(':web:')) return envAppId;
  return fallbackConfig.appId;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FB_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: resolveFirebaseAppId(),
};

function ensureFirebaseConfig() {
  const missing = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'].filter(
    (key) => !String(firebaseConfig[key] || '').trim()
  );
  if (missing.length) {
    throw new Error('Image upload is not configured right now. Paste an image URL instead.');
  }
}

function formatUploadError(error) {
  const code = String(error?.code || '').toLowerCase();
  const serverResponse = String(error?.serverResponse || error?.customData?.serverResponse || '').trim();

  if (code.includes('retry-limit-exceeded')) {
    return 'Image upload took too long. Try again, or paste an image URL instead.';
  }
  if (code.includes('unauthorized') || code.includes('unauthenticated')) {
    return 'Image upload is not authorized right now. Paste an image URL instead.';
  }
  if (code.includes('quota-exceeded')) {
    return 'Image upload is temporarily unavailable. Paste an image URL or use a destination cover instead.';
  }
  if (
    code.includes('invalid-default-bucket') ||
    code.includes('no-default-bucket') ||
    code.includes('bucket-not-found') ||
    code.includes('project-not-found')
  ) {
    return 'Image storage is not configured correctly right now. Paste an image URL instead.';
  }
  if (serverResponse) {
    return `Image upload failed. ${serverResponse}`;
  }
  return 'Image upload failed. Paste an image URL instead.';
}

function ensureFirebaseStorage() {
  ensureFirebaseConfig();
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const bucket = String(firebaseConfig.storageBucket || '').trim().replace(/^gs:\/\//, '');
  const storage = bucket ? getStorage(app, `gs://${bucket}`) : getStorage(app);
  storage.maxUploadRetryTime = 15000;
  storage.maxOperationRetryTime = 10000;
  return storage;
}

function sanitizePathPart(value, fallback = 'guest') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function inferExtension(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return 'jpg';
}

export async function uploadImageFile(file, { folder = 'uploads', ownerId = 'guest' } = {}) {
  if (!file) throw new Error('Choose an image first.');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }
  const maxBytes = 10 * 1024 * 1024;
  if (Number(file.size || 0) > maxBytes) {
    throw new Error('Images must be 10MB or smaller.');
  }

  const extension = inferExtension(file);
  const safeFolder = sanitizePathPart(folder, 'uploads');
  const safeOwner = sanitizePathPart(ownerId, 'guest');
  try {
    const storage = ensureFirebaseStorage();
    const storageRef = ref(storage, `${safeFolder}/${safeOwner}/${Date.now()}.${extension}`);

    await uploadBytes(storageRef, file, {
      contentType: file.type || `image/${extension}`,
    });

    return getDownloadURL(storageRef);
  } catch (error) {
    throw new Error(formatUploadError(error));
  }
}

export default {
  uploadImageFile,
};

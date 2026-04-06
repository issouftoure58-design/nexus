/**
 * usePushNotifications — Hook React pour les Web Push Notifications
 * Gère l'enregistrement du service worker, la souscription push,
 * et la communication avec le backend NEXUS.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushState {
  permission: PushPermission;
  subscribed: boolean;
  loading: boolean;
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    permission: isPushSupported() ? (Notification.permission as PushPermission) : 'unsupported',
    subscribed: false,
    loading: true,
  });

  // Vérifier le statut au montage
  useEffect(() => {
    if (!isPushSupported()) {
      setState({ permission: 'unsupported', subscribed: false, loading: false });
      return;
    }

    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!registration) {
        setState(s => ({ ...s, subscribed: false, loading: false }));
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      setState(s => ({
        ...s,
        permission: Notification.permission as PushPermission,
        subscribed: !!subscription,
        loading: false,
      }));
    } catch {
      setState(s => ({ ...s, subscribed: false, loading: false }));
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isPushSupported()) return false;

    setState(s => ({ ...s, loading: true }));

    try {
      // 1. Enregistrer le service worker
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // 2. Récupérer la clé VAPID depuis le backend
      const { vapidPublicKey } = await api.get<{ vapidPublicKey: string }>('/admin/push-subscriptions/vapid-key');
      if (!vapidPublicKey) {
        throw new Error('Clé VAPID non disponible');
      }

      // 3. Demander la permission + créer la subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 4. Envoyer au backend
      const subJson = subscription.toJSON();
      await api.post('/admin/push-subscriptions', {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      });

      setState({
        permission: 'granted',
        subscribed: true,
        loading: false,
      });

      return true;
    } catch (err) {
      const permission = Notification.permission as PushPermission;
      setState(s => ({ ...s, permission, subscribed: false, loading: false }));
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();

          // Supprimer côté backend
          await api.delete(`/admin/push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`);
        }
      }

      setState(s => ({ ...s, subscribed: false, loading: false }));
      return true;
    } catch {
      setState(s => ({ ...s, loading: false }));
      return false;
    }
  }, []);

  return {
    ...state,
    supported: isPushSupported(),
    subscribe,
    unsubscribe,
  };
}

/**
 * Convertit une clé VAPID base64url en Uint8Array (requis par PushManager.subscribe)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

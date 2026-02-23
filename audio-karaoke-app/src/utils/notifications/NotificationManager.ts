/**
 * Utility for managing browser Notification API
 */
class NotificationManager {
    private permission: NotificationPermission = 'default';

    constructor() {
        if (typeof Notification !== 'undefined') {
            this.permission = Notification.permission;
        }
    }

    /**
     * Request notification permissions from the user
     */
    async requestPermission(): Promise<NotificationPermission> {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return 'denied';
        }

        if (Notification.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }
        
        return this.permission;
    }

    /**
     * Send a browser notification
     */
    async sendNotification(title: string, options?: NotificationOptions): Promise<void> {
        if (typeof window === 'undefined') {
            // If in a Worker/Service Worker context, we use self.registration.showNotification
            if ('registration' in self && 'showNotification' in (self as unknown as ServiceWorkerGlobalScope).registration) {
                await (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(title, {
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-192x192.png',
                    ...options
                });
            }
            return;
        }

        if (!('Notification' in window)) return;

        if (this.permission !== 'granted') {
            // Attempt to request if not already denied
            if (this.permission === 'default' as NotificationPermission) {
                await this.requestPermission();
            }
            
            if (this.permission !== 'granted' as NotificationPermission) return;
        }

        const notification = new Notification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            ...options
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }

    /**
     * Send a notification specifically for a completed audio job
     */
    async notifyJobComplete(fileName: string, fileHash: string, modelId: string): Promise<void> {
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
        const jobUrl = origin ? `${origin}/karaoke/${fileHash}` : undefined;

        await this.sendNotification('Separation Complete!', {
            body: `"${fileName}" is ready for karaoke.`,
            tag: `muzika-job-${fileHash}`,
            renotify: true,
            data: { 
                url: jobUrl,
                fileHash,
                modelId
            },
            actions: [
                {
                    action: 'play-now',
                    title: 'Play Now'
                },
                {
                    action: 'download',
                    title: 'Download'
                }
            ]
        } as NotificationOptions);
    }

    get isSupported(): boolean {
        if (typeof window !== 'undefined') {
            return 'Notification' in window;
        }
        return typeof self !== 'undefined' && 'registration' in self;
    }
}

export const notificationManager = new NotificationManager();

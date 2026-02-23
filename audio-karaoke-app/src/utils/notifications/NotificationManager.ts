/**
 * Utility for managing browser Notification API
 */
class NotificationManager {
    private permission: NotificationPermission = 'default';

    constructor() {
        if (typeof window !== 'undefined' && 'Notification' in window) {
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
    async sendNotification(title: string, options?: NotificationOptions): Promise<Notification | null> {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return null;
        }

        if (this.permission !== 'granted') {
            // Attempt to request if not already denied
            if (this.permission === 'default') {
                await this.requestPermission();
            }
            
            if (this.permission !== 'granted') return null;
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

        return notification;
    }

    /**
     * Send a notification specifically for a completed audio job
     */
    async notifyJobComplete(fileName: string): Promise<void> {
        await this.sendNotification('Separation Complete!', {
            body: `"${fileName}" is ready for karaoke.`,
            tag: `muzika-job-${fileName}`,
            renotify: true
        });
    }

    get isSupported(): boolean {
        return typeof window !== 'undefined' && 'Notification' in window;
    }
}

export const notificationManager = new NotificationManager();

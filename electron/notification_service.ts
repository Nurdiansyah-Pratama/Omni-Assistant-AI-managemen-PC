import { Notification } from "electron";

export function showNotification(title: string, body: string) {
  if (!Notification.isSupported()) return false;
  const notification = new Notification({ title, body, silent: false });
  notification.show();
  return true;
}

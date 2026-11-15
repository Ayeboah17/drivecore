export interface NotificationItem {
  id: string;
  message: string;
  branchName: string;
  href: string;
}
export interface NotificationResult {
  items: NotificationItem[];
  retrievedAt: string;
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}${days === 1 ? " day ago" : " days ago"}`;
  if (hours > 0) return `${hours}${hours === 1 ? " hour ago" : " hours ago"}`;
  return `${mins}${mins === 1 ? " minute ago" : " minutes ago"}`;
}

export function displayName(
  user: { username?: string | null } | null,
  wallet: string,
): string {
  if (user?.username) return user.username;
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

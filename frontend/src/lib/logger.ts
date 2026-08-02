export const logger = {
  error(message: string, error?: unknown): void {
    console.error(message, error);
  },
  warn(message: string, meta?: unknown): void {
    console.warn(message, meta);
  },
  info(message: string, meta?: unknown): void {
    console.info(message, meta);
  },
};

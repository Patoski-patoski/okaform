export class WalletNotConnectedError extends Error {
  constructor() {
    super("Wallet not connected.");
    this.name = "WalletNotConnectedError";
    Object.setPrototypeOf(this, WalletNotConnectedError.prototype);
  }
}

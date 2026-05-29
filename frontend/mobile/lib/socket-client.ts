declare const require: any;

export interface SocketLike {
  connected: boolean;
  on(event: string, listener: (...args: any[]) => void): SocketLike;
  off(event: string, listener?: (...args: any[]) => void): SocketLike;
  emit(event: string, ...args: any[]): SocketLike;
  disconnect(): SocketLike;
}

export interface SocketClientOptions {
  path?: string;
  auth?: Record<string, unknown>;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  transports?: string[];
  timeout?: number;
}

type SocketFactory = (uri: string, options?: SocketClientOptions) => SocketLike;

const loadSocketClient = (): SocketFactory => {
  const moduleExport = require("socket.io-client");
  return (moduleExport?.default ?? moduleExport) as SocketFactory;
};

export default function io(
  uri: string,
  options?: SocketClientOptions,
): SocketLike {
  return loadSocketClient()(uri, options);
}

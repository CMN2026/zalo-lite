declare module "socket.io-client" {
  export interface Socket {
    connected: boolean;
    on(event: string, listener: (...args: any[]) => void): Socket;
    off(event: string, listener?: (...args: any[]) => void): Socket;
    emit(event: string, ...args: any[]): Socket;
    disconnect(): Socket;
  }

  export interface ManagerOptions {
    path?: string;
    auth?: Record<string, unknown>;
    reconnection?: boolean;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    reconnectionAttempts?: number;
    transports?: string[];
    timeout?: number;
  }

  export default function io(uri: string, options?: ManagerOptions): Socket;
}

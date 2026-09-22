import { ClientProxy } from '@galaxy-stack/orbit-microservices';
import type { TcpOptions, ReadPacket, WritePacket, OutgoingMessage } from '@galaxy-stack/orbit-microservices';

export class TcpClient extends ClientProxy {
  private socket: any = null;
  private readonly options: Required<TcpOptions>;
  private buffer = '';
  private callbacks = new Map<string, (response: WritePacket) => void>();
  private reconnectAttempts = 0;

  constructor(options: TcpOptions = {}) {
    super();
    this.options = {
      host: options.host || 'localhost',
      port: options.port ?? 3001,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.socket) {
      return;
    }

    const self = this;

    return new Promise((resolve, reject) => {
      Bun.connect({
        hostname: this.options.host,
        port: this.options.port,
        socket: {
          data(socket, data) {
            const text = self.buffer + new TextDecoder().decode(data);
            const messages = text.split('\n');
            
            self.buffer = messages.pop() || '';
            
            for (const msg of messages) {
              if (!msg.trim()) continue;
              
              try {
                const response: OutgoingMessage = JSON.parse(msg);
                if (response.id) {
                  const callback = self.callbacks.get(response.id);
                  if (callback) {
                    self.callbacks.delete(response.id);
                    callback({
                      response: response.response,
                      err: response.err,
                    });
                  }
                }
              } catch (e) {
                console.error('Failed to parse response:', e);
              }
            }
          },
          open(socket) {
            self.socket = socket;
            self.isConnected = true;
            self.reconnectAttempts = 0;
            resolve();
          },
          close() {
            self.isConnected = false;
            self.socket = null;
          },
          error(socket, error) {
            console.error('TCP Client error:', error);
            if (!self.isConnected) {
              reject(error);
            }
          },
          connectError(socket, error) {
            reject(error);
          },
        },
      });
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.end?.();
      this.socket = null;
    }
    this.isConnected = false;
    this.callbacks.clear();
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => void): () => void {
    const id = this.generateId();
    this.callbacks.set(id, callback);

    const message = JSON.stringify({
      pattern: packet.pattern,
      data: packet.data,
      id,
    }) + '\n';

    if (this.socket) {
      this.socket.write(message);
    }

    return () => {
      this.callbacks.delete(id);
    };
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<void> {
    const message = JSON.stringify({
      pattern: packet.pattern,
      data: packet.data,
    }) + '\n';

    if (this.socket) {
      this.socket.write(message);
    }
  }
}

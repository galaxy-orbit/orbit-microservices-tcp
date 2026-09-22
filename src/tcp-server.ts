import { Server } from '@galaxy-stack/orbit-microservices';
import type { TcpOptions, IncomingMessage, OutgoingMessage } from '@galaxy-stack/orbit-microservices';

export class TcpServer extends Server {
  private server: any = null;
  private readonly options: Required<TcpOptions>;
  private clients = new Set<any>();

  constructor(options: TcpOptions = {}) {
    super();
    this.options = {
      host: options.host || '0.0.0.0',
      port: options.port ?? 3001,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }

  async listen(callback: () => void): Promise<void> {
    const self = this;
    
    this.server = Bun.listen<{ buffer: string }>({
      hostname: this.options.host,
      port: this.options.port,
      socket: {
        data(socket, data) {
          const text = socket.data.buffer + new TextDecoder().decode(data);
          const messages = text.split('\n');
          
          socket.data.buffer = messages.pop() || '';
          
          for (const msg of messages) {
            if (!msg.trim()) continue;
            
            try {
              const parsed: IncomingMessage = JSON.parse(msg);
              self.handleMessage(parsed.pattern, parsed.data, (response: OutgoingMessage) => {
                const responseWithId = { ...response, id: parsed.id };
                socket.write(JSON.stringify(responseWithId) + '\n');
              });
            } catch (e) {
              socket.write(JSON.stringify({ err: 'Invalid message format' }) + '\n');
            }
          }
        },
        open(socket) {
          socket.data = { buffer: '' };
          self.clients.add(socket);
        },
        close(socket) {
          self.clients.delete(socket);
        },
        error(socket, error) {
          console.error('TCP Socket error:', error);
        },
      },
    });

    callback?.();
  }

  async close(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
    this.clients.clear();
  }

  getPort(): number {
    return this.options.port;
  }

  getHost(): string {
    return this.options.host;
  }
}

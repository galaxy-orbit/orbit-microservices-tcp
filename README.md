# @galaxy-stack/orbit-microservices-tcp

[![npm version](https://img.shields.io/npm/v/@galaxy-stack/orbit-microservices-tcp.svg)](https://www.npmjs.com/package/@galaxy-stack/orbit-microservices-tcp)
[![docs](https://img.shields.io/badge/docs-galaxy--orbit--framework.vercel.app-blue)](https://galaxy-orbit-framework.vercel.app)

Part of the [Orbit framework](https://github.com/galaxy-orbit/packages) — a NestJS-style backend framework for [Bun](https://bun.sh).

## Installation

```bash
bun add @galaxy-stack/orbit-microservices-tcp
```

# @galaxy-stack/orbit-microservices-tcp

> **Status**: ✅ Full Implementation - Complete length-prefixed protocol với Bun native TCP

## Mô tả

TCP transport implementation cho Orbit microservices với binary protocol.

## Tính năng

- Length-prefixed binary protocol (4-byte header)
- Request-response và event patterns
- Automatic reconnection với retry logic
- Connection state management
- JSON serialization với custom serializer support
- Error recovery và graceful shutdown

## Cài đặt

```bash
bun add @galaxy-stack/orbit-microservices-tcp
```

## Sử dụng

### TCP Server

```typescript
import { BunFactory } from '@galaxy-stack/orbit-core';
import '@galaxy-stack/orbit-microservices-tcp';

const app = await BunFactory.createMicroservice(AppModule, {
  transport: 'TCP',
  options: {
    host: 'localhost',
    port: 3001,
    retryAttempts: 5,
    retryDelay: 1000,
  },
});

await app.listen();
// [TcpServer] Listening on tcp://localhost:3001
```

### TCP Client

```typescript
import { MicroservicesModule } from '@galaxy-stack/orbit-microservices';
import '@galaxy-stack/orbit-microservices-tcp';

@Module({
  imports: [
    MicroservicesModule.register({
      name: 'MATH_SERVICE',
      transport: 'TCP',
      options: {
        host: 'localhost',
        port: 3001,
      },
    }),
  ],
})
class ClientModule {}
```

### Message Handlers

```typescript
import { Controller, MessagePattern, EventPattern } from '@galaxy-stack/orbit-microservices';

@Controller()
class MathController {
  @MessagePattern('sum')
  sum(data: { a: number; b: number }): number {
    return data.a + data.b;
  }

  @EventPattern('user.created')
  handleUserCreated(data: { userId: number }): void {
    console.log('User created:', data.userId);
  }
}
```

### Client Usage

```typescript
import { Inject } from '@galaxy-stack/orbit-core';
import { ClientProxy } from '@galaxy-stack/orbit-microservices';

@Injectable()
class OrderService {
  constructor(
    @Inject('MATH_SERVICE') private client: ClientProxy
  ) {}

  async calculateSum(a: number, b: number): Promise<number> {
    return this.client.send('sum', { a, b });
  }

  notifyUserCreated(userId: number): void {
    this.client.emit('user.created', { userId });
  }
}
```

## Options

### TcpServerOptions

```typescript
interface TcpServerOptions {
  host?: string;           // Default: 'localhost'
  port?: number;           // Default: 3000
  retryAttempts?: number;  // Default: 3
  retryDelay?: number;     // Default: 1000ms
  serializer?: {
    serialize: (value: any) => string;
    deserialize: (value: string) => any;
  };
}
```

### TcpClientOptions

```typescript
interface TcpClientOptions extends TcpServerOptions {
  requestTimeout?: number; // Default: 30000ms
}
```

## Protocol

TCP transport sử dụng length-prefixed binary protocol:

```
┌────────────────┬────────────────────────────┐
│ Length (4B BE) │ JSON Payload (N bytes)     │
└────────────────┴────────────────────────────┘
```

### Message Format

```typescript
interface TcpMessage {
  pattern: string;          // Message pattern
  data: any;                // Payload
  id?: string;              // Correlation ID for RPC
  replyTo?: string;         // Reply pattern for RPC
}
```

### Message Types

| Type | Description |
|------|-------------|
| Request | `{ pattern, data, id }` - Expects response |
| Response | `{ id, data, error? }` - RPC response |
| Event | `{ pattern, data }` - Fire-and-forget |

## Error Handling

```typescript
try {
  const result = await client.send('divide', { a: 10, b: 0 });
} catch (error) {
  console.error(error.message); // 'Division by zero'
}
```

## Reconnection

Automatic reconnection với configurable retry:

- Retry attempts: configurable (default: 3)
- Retry delay: configurable (default: 1000ms)
- Exponential backoff support

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application                          │
├─────────────────────────────────────────────────────────┤
│      TcpServer           │         TcpClient           │
├─────────────────────────────────────────────────────────┤
│              TcpConnection (Bun.listen/connect)         │
├─────────────────────────────────────────────────────────┤
│              Length-Prefix Protocol Handler             │
├─────────────────────────────────────────────────────────┤
│                   Bun Native TCP                        │
└─────────────────────────────────────────────────────────┘
```

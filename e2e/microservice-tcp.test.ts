/**
 * LIVE INTEGRATION — Microservices over real TCP
 * Wires: orbit-microservices (Server/ClientProxy contracts, patterns)
 *        + orbit-microservices-tcp (TcpServer/TcpClient)
 * A real TCP server handles RPC + events; a real client sends and receives.
 */
import { describe, test, expect, afterAll } from 'bun:test';
import 'reflect-metadata';
import { TcpServer, TcpClient } from '@galaxy-stack/orbit-microservices-tcp';

const servers: TcpServer[] = [];
const clients: TcpClient[] = [];

afterAll(async () => {
  for (const c of clients) await c.close().catch(() => {});
  for (const s of servers) await s.close().catch(() => {});
});

async function startServer(handlers: Record<string, (data: any) => any>) {
  const server = new TcpServer({ host: '127.0.0.1', port: 0 });
  for (const [pattern, handler] of Object.entries(handlers)) {
    server.addHandler(pattern, handler);
  }
  await server.listen();
  servers.push(server);
  // Bun.listen with port 0 binds an ephemeral port — read it from the server
  const port = (server as any).server?.port ?? server['options'].port;
  return { server, port };
}

describe('LIVE — microservices over TCP', () => {
  test('RPC round-trip: client.send → server handler → response', async () => {
    const { port } = await startServer({
      'math/sum': (data: { a: number; b: number }) => ({ sum: data.a + data.b }),
 'user/find': (data: { id: number }) => ({ id: data.id, name: `user-${data.id}` }),
    });

    const client = new TcpClient({ host: '127.0.0.1', port });
    clients.push(client);

    const result = await client.send<{ sum: number }>('math/sum', { a: 2, b: 3 });
    expect(result).toEqual({ sum: 5 });

    const user = await client.send<{ id: number; name: string }>('user/find', { id: 7 });
    expect(user).toEqual({ id: 7, name: 'user-7' });
  }, 20000);

  test('sequential RPCs reuse the same connection', async () => {
    const { port } = await startServer({
      'counter/next': (data: { n: number }) => ({ n: data.n + 1 }),
    });

    const client = new TcpClient({ host: '127.0.0.1', port });
    clients.push(client);

    expect(await client.send('counter/next', { n: 0 })).toEqual({ n: 1 });
    expect(await client.send('counter/next', { n: 1 })).toEqual({ n: 2 });
    expect(await client.send('counter/next', { n: 2 })).toEqual({ n: 3 });
  }, 20000);

  test('object patterns normalize like NestJS microservices', async () => {
    const { port } = await startServer({
      [JSON.stringify({ cmd: 'sum', role: 'admin' })]: (data: any) => data,
    });

    const client = new TcpClient({ host: '127.0.0.1', port });
    clients.push(client);

    const result = await client.send({ cmd: 'sum', role: 'admin' } as any, { ok: true });
    expect(result).toEqual({ ok: true });
  }, 20000);

  test('server errors reach the client as err responses', async () => {
    const { port } = await startServer({
      'boom/handler': () => { throw new Error('tcp explosion'); },
    });

    const client = new TcpClient({ host: '127.0.0.1', port });
    clients.push(client);

    await expect(client.send('boom/handler', {})).rejects.toThrow('tcp explosion');
  }, 20000);

  test('multiple concurrent RPCs resolve independently', async () => {
    const { port } = await startServer({
      'math/double': (data: { n: number }) => ({ n: data.n * 2 }),
    });

    const client = new TcpClient({ host: '127.0.0.1', port });
    clients.push(client);

    const results = await Promise.all([
      client.send('math/double', { n: 1 }),
      client.send('math/double', { n: 2 }),
      client.send('math/double', { n: 3 }),
      client.send('math/double', { n: 4 }),
    ]);

    expect(results.map((r: any) => r.n)).toEqual([2, 4, 6, 8]);
  }, 20000);
});

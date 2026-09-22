import { describe, test, expect, afterAll } from 'bun:test';
import { TcpServer } from './tcp-server';
import { TcpClient } from './tcp-client';

const server = new TcpServer({ host: '127.0.0.1', port: 0 });
const client = new TcpClient({ host: '127.0.0.1', port: 0 });

// use a fixed high port for determinism
const PORT = 33_211;
const serverFixed = new TcpServer({ host: '127.0.0.1', port: PORT });
const clientFixed = new TcpClient({ host: '127.0.0.1', port: PORT });

afterAll(async () => {
  await serverFixed.close();
  await clientFixed.close();
  await server.close();
  await client.close();
});

describe('TcpServer/TcpClient', () => {
  test('server and client exchange RPC over real TCP', async () => {
    await serverFixed.listen(() => {});
    serverFixed.addHandler('sum', async (data: number[]) => data.reduce((a, b) => a + b, 0));
    await clientFixed.connect();

    const result = await clientFixed.send<number, number[]>('sum', [1, 2, 3]);
    expect(result).toBe(6);
  });

  test('second RPC on the same connection', async () => {
    serverFixed.addHandler('greet', async (name: string) => `hi ${name}`);
    const result = await clientFixed.send<string, string>('greet', 'orbit');
    expect(result).toBe('hi orbit');
    const again = await clientFixed.send<string, string>('greet', 'again');
    expect(again).toBe('hi again');
  });

  test('error from handler surfaces via err response', async () => {
    serverFixed.addHandler('explode', async () => { throw new Error('tcp boom'); });
    await expect(clientFixed.send('explode', {})).rejects.toThrow('tcp boom');
  });

  test('server options expose host/port', () => {
    expect(serverFixed.getPort()).toBe(PORT);
    expect(serverFixed.getHost()).toBe('127.0.0.1');
  });
});

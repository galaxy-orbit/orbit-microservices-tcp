import { registerTransport, Transport } from '@galaxy-stack/orbit-microservices';
import { TcpServer } from './tcp-server';
import { TcpClient } from './tcp-client';

registerTransport(Transport.TCP, TcpServer, TcpClient);

export { TcpServer } from './tcp-server';
export { TcpClient } from './tcp-client';

import { setupServer } from 'msw/node';

// No default handlers: each test declares its own via `server.use(...)`.
export const server = setupServer();

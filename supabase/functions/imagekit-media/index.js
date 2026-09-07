import { handleRequest } from './handler.mjs';

Deno.serve(req => handleRequest(req, { env: name => Deno.env.get(name), fetch }));

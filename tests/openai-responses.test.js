import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import express from 'express';
import { fileURLToPath } from 'node:url';

import { setConfigFilePath } from '../src/util.js';
import { CHAT_COMPLETION_SOURCES } from '../src/constants.js';
import { MockServer } from './util/mock-server.js';

setConfigFilePath(fileURLToPath(new URL('../config.yaml', import.meta.url)));

describe('OpenAI Responses integration', () => {
    /** @type {import('express').Router} */
    let chatCompletionsRouter;
    /** @type {MockServer} */
    let upstream;
    /** @type {import('http').Server} */
    let appServer;

    beforeAll(async () => {
        ({ router: chatCompletionsRouter } = await import('../src/endpoints/backends/chat-completions.js'));

        upstream = new MockServer({ port: 3001, host: '127.0.0.1' });
        await upstream.start();

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = {
                directories: {
                    root: '/tmp/sillybunny-test-user',
                },
            };
            next();
        });
        app.use('/api/backends/chat-completions', chatCompletionsRouter);

        await new Promise((resolve) => {
            appServer = app.listen(3010, '127.0.0.1', resolve);
        });
    });

    afterAll(async () => {
        await upstream.stop();

        if (appServer) {
            await new Promise((resolve, reject) => {
                appServer.close((err) => err ? reject(err) : resolve());
            });
        }
    });

    test('status accepts OpenAI Responses using the OpenAI models endpoint', async () => {
        const response = await fetch('http://127.0.0.1:3010/api/backends/chat-completions/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: CHAT_COMPLETION_SOURCES.OPENAI_RESPONSES,
                reverse_proxy: 'http://127.0.0.1:3001/v1/',
                proxy_password: 'test-key',
            }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual({
            data: [
                { id: 'gpt-4o-mini' },
                { id: 'gpt-5.4' },
            ],
        });
    });

    test('generate proxies OpenAI Responses requests to /v1/responses even with trailing slash reverse proxy', async () => {
        const response = await fetch('http://127.0.0.1:3010/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_completion_source: CHAT_COMPLETION_SOURCES.OPENAI_RESPONSES,
                reverse_proxy: 'http://127.0.0.1:3001/v1/',
                proxy_password: 'test-key',
                model: 'gpt-5.4',
                stream: false,
                temperature: 1,
                max_tokens: 32,
                top_p: 1,
                messages: [
                    { role: 'system', content: 'Be concise.' },
                    { role: 'user', content: 'Hello from Responses.' },
                ],
            }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual({
            id: 'resp-test-1',
            object: 'chat.completion',
            created: expect.any(Number),
            model: 'gpt-5.4',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Hello from Responses.',
                        reasoning_content: 'gpt-5.4\n1\n32',
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: 12,
                completion_tokens: 5,
                total_tokens: 17,
            },
        });
    });
});

import '@testing-library/jest-dom';
import 'whatwg-fetch';

import { TextDecoder, TextEncoder } from 'util';

jest.mock('ldrs', () => ({
	waveform: {
		register: jest.fn(),
	},
}));

process.env.REACT_APP_TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY || 'test-key';

if (typeof global.TextEncoder === 'undefined') {
	global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
	global.TextDecoder = TextDecoder;
}

if (typeof global.TransformStream === 'undefined') {

	const { TransformStream } = require('stream/web');
	global.TransformStream = TransformStream;
}

const { server } = require('./test-utils/server');

class MockIntersectionObserver {
	constructor(callback) {
		this.callback = callback;
	}

	observe(element) {
		this.callback?.([{ isIntersecting: true, target: element }]);
	}

	unobserve() {}

	disconnect() {}
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
	window.IntersectionObserver = MockIntersectionObserver;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());



import type { PlaywrightTestConfig } from '@playwright/test';

export default {
	use: {
		headless: true,
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		channel: 'chrome',
		launchOptions: {
			// force GPU hardware acceleration
			// (even in headless mode)
			args: ['--use-gl=egl', '--use-fake-ui-for-media-stream'],
		},
		permissions: ['microphone'],
	},
	outputDir: 'tests/e2e/.playwright',
	reporter: 'list',
	testDir: 'tests/e2e/federation',
	workers: 1,
	retries: 2,
	timeout: 60 * 1000,
	globalTimeout: 40 * 60 * 1000,
	maxFailures: 5,
} as PlaywrightTestConfig;
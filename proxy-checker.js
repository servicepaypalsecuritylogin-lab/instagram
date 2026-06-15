#!/usr/bin/env node
/**
 * Proxy Health & Latency Checker
 * Validates proxy pool before deployment
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const readline = require('readline');

// ============================================
// PROXY TEST CONFIGURATION
// ============================================
const CONFIG = {
    testUrl: 'https://www.instagram.com/',
    timeout: 15000,
    concurrent: 10,
    retries: 2
};

// ============================================
// PROXY TESTER CLASS
// ============================================

class ProxyTester {
    constructor() {
        this.results = [];
        this.working = [];
        this.failed = [];
    }

    /**
     * Parse proxy line from file
     */
    parseProxy(line) {
        line = line.trim();
        if (!line || line.startsWith('#')) return null;
        
        const parts = line.split(':');
        if (parts.length === 4) {
            return {
                host: parts[0],
                port: parseInt(parts[1]),
                auth: { username: parts[2], password: parts[3] },
                protocol: 'http',
                original: line
            };
        } else if (parts.length === 2) {
            return {
                host: parts[0],
                port: parseInt(parts[1]),
                auth: null,
                protocol: 'http',
                original: line
            };
        }
        return null;
    }

    /**
     * Test single proxy
     */
    async testProxy(proxy) {
        const startTime = Date.now();
        
        const proxyUrl = proxy.auth
            ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`
            : `http://${proxy.host}:${proxy.port}`;

        const agent = new http.Agent({
            proxy: proxyUrl,
            timeout: CONFIG.timeout
        });

        const options = {
            hostname: 'www.instagram.com',
            port: 443,
            path: '/',
            method: 'HEAD',
            agent: agent,
            timeout: CONFIG.timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        };

        return new Promise((resolve) => {
            const req = https.request(options, (res) => {
                const latency = Date.now() - startTime;
                const success = res.statusCode >= 200 && res.statusCode < 400;
                
                resolve({
                    proxy,
                    success,
                    statusCode: res.statusCode,
                    latency,
                    error: null
                });
            });

            req.on('error', (err) => {
                resolve({
                    proxy,
                    success: false,
                    statusCode: null,
                    latency: Date.now() - startTime,
                    error: err.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    proxy,
                    success: false,
                    statusCode: null,
                    latency: CONFIG.timeout,
                    error: 'Timeout'
                });
            });

            req.end();
        });
    }

    /**
     * Test proxy with retries
     */
    async testWithRetries(proxy, attempt = 1) {
        const result = await this.testProxy(proxy);
        
        if (result.success || attempt >= CONFIG.retries) {
            return { ...result, attempts: attempt };
        }
        
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return this.testWithRetries(proxy, attempt + 1);
    }

    /**
     * Run full proxy pool test
     */
    async testAll(proxyFile) {
        const proxies = fs.readFileSync(proxyFile, 'utf8')
            .split('\n')
            .map(line => this.parseProxy(line))
            .filter(p => p !== null);

        console.log(`[ProxyChecker] Testing ${proxies.length} proxies with ${CONFIG.concurrent} concurrent connections...\n`);

        const batches = [];
        for (let i = 0; i < proxies.length; i += CONFIG.concurrent) {
            batches.push(proxies.slice(i, i + CONFIG.concurrent));
        }

        let completed = 0;
        
        for (const batch of batches) {
            const results = await Promise.all(
                batch.map(p => this.testWithRetries(p))
            );
            
            for (const result of results) {
                completed++;
                this.results.push(result);
                
                if (result.success) {
                    this.working.push(result);
                    console.log(`✓ ${result.proxy.original} | ${result.latency}ms | HTTP ${result.statusCode}`);
                } else {
                    this.failed.push(result);
                    console.log(`✗ ${result.proxy.original} | ${result.error} | Attempts: ${result.attempts}`);
                }
            }
            
            // Progress indicator
            process.stdout.write(`\nProgress: ${completed}/${proxies.length} (${Math.round(completed/proxies.length*100)}%)\n`);
            
            // Delay between batches
            await new Promise(r => setTimeout(r, 500));
        }

        this.printSummary();
        this.saveWorking();
    }

    /**
     * Print test summary
     */
    printSummary() {
        const total = this.results.length;
        const working = this.working.length;
        const failed = this.failed.length;
        const avgLatency = this.working.reduce((sum, r) => sum + r.latency, 0) / working;
        const fastest = this.working.reduce((min, r) => r.latency < min.latency ? r : min, this.working[0]);

        console.log(`\n${'='.repeat(60)}`);
        console.log('PROXY CHECK RESULTS');
        console.log(`${'='.repeat(60)}`);
        console.log(`Total tested:     ${total}`);
        console.log(`Working:          ${working} (${(working/total*100).toFixed(1)}%)`);
        console.log(`Failed:           ${failed} (${(failed/total*100).toFixed(1)}%)`);
        console.log(`Average latency:  ${avgLatency ? avgLatency.toFixed(0) : 'N/A'}ms`);
        if (fastest) {
            console.log(`Fastest proxy:    ${fastest.proxy.original} (${fastest.latency}ms)`);
        }
        console.log(`${'='.repeat(60)}\n`);
    }

    /**
     * Save working proxies to file
     */
    saveWorking() {
        const output = this.working.map(r => r.proxy.original).join('\n');
        fs.writeFileSync('proxies_working.txt', output);
        console.log('[ProxyChecker] Working proxies saved to proxies_working.txt');
    }
}

// ============================================
// CLI INTERFACE
// ============================================

async function main() {
    const args = process.argv.slice(2);
    const proxyFile = args[0] || 'proxies.txt';

    if (!fs.existsSync(proxyFile)) {
        console.error(`[ProxyChecker] File not found: ${proxyFile}`);
        console.log('Usage: node proxy-checker.js <proxy-file>');
        process.exit(1);
    }

    const tester = new ProxyTester();
    await tester.testAll(proxyFile);
}

main().catch(console.error);
#!/usr/bin/env node
/**
 * IG-BOT-NET Control Server
 * Manages worker pools, proxy rotation, account databases, and delivery queues
 * Requires: node >= 18, puppeteer, ws, express
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { Worker } = require('worker_threads');
const EventEmitter = require('events');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    port: process.env.BOT_PORT || 7777,
    dashboardPort: process.env.DASH_PORT || 7778,
    workerCount: parseInt(process.env.WORKERS) || 4,
    proxyRotationInterval: 300000, // 5 minutes
    actionDelayMin: 2000,
    actionDelayMax: 8000,
    maxRetries: 3,
    userAgentPool: [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.71 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    ],
    instagramEndpoints: {
        base: 'https://www.instagram.com',
        login: 'https://www.instagram.com/accounts/login/',
        graphql: 'https://www.instagram.com/api/v1/web/accounts/',
        follow: 'https://www.instagram.com/web/friendships/{userId}/follow/',
        unfollow: 'https://www.instagram.com/web/friendships/{userId}/unfollow/',
        userInfo: 'https://www.instagram.com/api/v1/users/web_profile_info/?username={username}'
    },
    databasePath: path.join(__dirname, 'data'),
    logsPath: path.join(__dirname, 'logs')
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Cryptographically secure random integer
 */
function secureRandom(min, max) {
    const range = max - min + 1;
    const bytes = require('crypto').randomBytes(4);
    const randomValue = bytes.readUInt32LE(0);
    return min + (randomValue % range);
}

/**
 * Sleep with jitter to avoid pattern detection
 */
function jitterSleep(baseMs, varianceMs = 1000) {
    const delay = baseMs + secureRandom(0, varianceMs);
    return new Promise(r => setTimeout(r, delay));
}

/**
 * Rotating proxy selector with weighted distribution
 */
class ProxyRotator {
    constructor(proxyListPath) {
        this.proxies = [];
        this.currentIndex = 0;
        this.failureCounts = new Map();
        this.loadProxies(proxyListPath);
    }

    loadProxies(proxyListPath) {
        try {
            const data = fs.readFileSync(proxyListPath, 'utf8');
            this.proxies = data.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(line => {
                    // Format: host:port:username:password or host:port
                    const parts = line.split(':');
                    if (parts.length === 4) {
                        return {
                            host: parts[0],
                            port: parseInt(parts[1]),
                            auth: { username: parts[2], password: parts[3] },
                            protocol: 'http',
                            weight: 1.0,
                            lastUsed: 0
                        };
                    }
                    return {
                        host: parts[0],
                        port: parseInt(parts[1]),
                        auth: null,
                        protocol: 'http',
                        weight: 1.0,
                        lastUsed: 0
                    };
                });
            console.log(`[ProxyRotator] Loaded ${this.proxies.length} proxies`);
        } catch (err) {
            console.warn('[ProxyRotator] No proxy file found, running direct');
            this.proxies = [{ host: 'direct', port: 0, weight: 1.0, lastUsed: 0 }];
        }
    }

    getNext() {
        if (this.proxies.length === 0) return null;
        
        // Weighted round-robin with cooldown
        const now = Date.now();
        const available = this.proxies.filter(p => {
            const failures = this.failureCounts.get(p.host) || 0;
            const cooldown = Math.min(failures * 60000, 300000); // Max 5min cooldown
            return (now - p.lastUsed) > cooldown;
        });

        if (available.length === 0) {
            // All proxies cooling down, reset and pick least failed
            const proxy = this.proxies.reduce((a, b) => {
                const fa = this.failureCounts.get(a.host) || 0;
                const fb = this.failureCounts.get(b.host) || 0;
                return fa < fb ? a : b;
            });
            proxy.lastUsed = now;
            return proxy;
        }

        // Weighted selection
        const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const proxy of available) {
            random -= proxy.weight;
            if (random <= 0) {
                proxy.lastUsed = now;
                return proxy;
            }
        }
        
        return available[0];
    }

    reportFailure(proxy) {
        const current = this.failureCounts.get(proxy.host) || 0;
        this.failureCounts.set(proxy.host, current + 1);
        proxy.weight = Math.max(0.1, proxy.weight * 0.8); // Reduce weight
        console.warn(`[ProxyRotator] Proxy ${proxy.host} failed (${current + 1} times)`);
    }

    reportSuccess(proxy) {
        this.failureCounts.delete(proxy.host);
        proxy.weight = Math.min(2.0, proxy.weight * 1.1); // Increase weight
    }
}

// ============================================
// BOT ACCOUNT MANAGER
// ============================================

class AccountManager {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.accounts = [];
        this.activeAccounts = new Set();
        this.cooldownMap = new Map();
        this.loadAccounts();
    }

    loadAccounts() {
        const accountFile = path.join(this.dbPath, 'accounts.json');
        try {
            if (fs.existsSync(accountFile)) {
                this.accounts = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
                console.log(`[AccountManager] Loaded ${this.accounts.length} accounts`);
            } else {
                console.warn('[AccountManager] No accounts database found');
                this.accounts = [];
            }
        } catch (err) {
            console.error('[AccountManager] Failed to load accounts:', err.message);
            this.accounts = [];
        }
    }

    saveAccounts() {
        const accountFile = path.join(this.dbPath, 'accounts.json');
        try {
            fs.mkdirSync(this.dbPath, { recursive: true });
            fs.writeFileSync(accountFile, JSON.stringify(this.accounts, null, 2));
        } catch (err) {
            console.error('[AccountManager] Failed to save accounts:', err.message);
        }
    }

    /**
     * Get available account with cooldown check
     */
    getAvailableAccount() {
        const now = Date.now();
        const available = this.accounts.filter(acc => {
            if (this.activeAccounts.has(acc.username)) return false;
            const cooldown = this.cooldownMap.get(acc.username);
            if (cooldown && now < cooldown) return false;
            return acc.status === 'active' && acc.sessionValid;
        });

        if (available.length === 0) return null;

        // Prefer accounts with lowest daily action count
        available.sort((a, b) => (a.dailyActions || 0) - (b.dailyActions || 0));
        const selected = available[0];
        this.activeAccounts.add(selected.username);
        return selected;
    }

    releaseAccount(username) {
        this.activeAccounts.delete(username);
    }

    setCooldown(username, durationMs = 3600000) {
        this.cooldownMap.set(username, Date.now() + durationMs);
    }

    incrementActions(username) {
        const acc = this.accounts.find(a => a.username === username);
        if (acc) {
            acc.dailyActions = (acc.dailyActions || 0) + 1;
            acc.totalActions = (acc.totalActions || 0) + 1;
            acc.lastAction = new Date().toISOString();
            this.saveAccounts();
        }
    }

    markInvalid(username, reason) {
        const acc = this.accounts.find(a => a.username === username);
        if (acc) {
            acc.status = 'invalid';
            acc.invalidReason = reason;
            acc.invalidAt = new Date().toISOString();
            this.activeAccounts.delete(username);
            this.saveAccounts();
        }
    }

    addAccount(username, password, email, proxy) {
        const existing = this.accounts.find(a => a.username === username);
        if (existing) {
            existing.password = password;
            existing.email = email;
            existing.proxy = proxy;
            existing.status = 'active';
            existing.updatedAt = new Date().toISOString();
        } else {
            this.accounts.push({
                username,
                password,
                email,
                proxy,
                status: 'active',
                sessionValid: false,
                csrfToken: null,
                sessionId: null,
                dsUserId: null,
                dailyActions: 0,
                totalActions: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastAction: null,
                invalidReason: null,
                invalidAt: null
            });
        }
        this.saveAccounts();
    }

    resetDailyCounters() {
        const now = new Date();
        this.accounts.forEach(acc => {
            const lastReset = acc.lastDailyReset ? new Date(acc.lastDailyReset) : null;
            if (!lastReset || lastReset.getDate() !== now.getDate()) {
                acc.dailyActions = 0;
                acc.lastDailyReset = now.toISOString();
            }
        });
        this.saveAccounts();
    }
}

// ============================================
// DELIVERY QUEUE MANAGER
// ============================================

class DeliveryQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.processing = false;
        this.stats = {
            totalDelivered: 0,
            totalFailed: 0,
            activeDeliveries: 0,
            queueLength: 0
        };
    }

    addDelivery(targetUsername, followerCount, priority = 'normal') {
        const delivery = {
            id: require('crypto').randomUUID(),
            targetUsername,
            followerCount,
            delivered: 0,
            failed: 0,
            status: 'pending',
            priority,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            workers: [],
            logs: []
        };

        // Insert by priority
        const priorityMap = { high: 0, normal: 1, low: 2 };
        const insertIndex = this.queue.findIndex(d => 
            priorityMap[d.priority] > priorityMap[priority]
        );
        
        if (insertIndex === -1) {
            this.queue.push(delivery);
        } else {
            this.queue.splice(insertIndex, 0, delivery);
        }

        this.stats.queueLength = this.queue.length;
        this.emit('delivery:added', delivery);
        
        if (!this.processing) {
            this.processQueue();
        }

        return delivery.id;
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const delivery = this.queue[0];
            
            if (delivery.status === 'cancelled') {
                this.queue.shift();
                continue;
            }

            delivery.status = 'active';
            delivery.startedAt = Date.now();
            this.emit('delivery:started', delivery);

            try {
                await this.executeDelivery(delivery);
            } catch (err) {
                delivery.logs.push({
                    time: new Date().toISOString(),
                    level: 'error',
                    message: err.message
                });
                delivery.status = 'failed';
                this.emit('delivery:failed', delivery);
            }

            if (delivery.status !== 'cancelled') {
                delivery.completedAt = Date.now();
                delivery.status = delivery.delivered >= delivery.followerCount * 0.8 ? 'completed' : 'partial';
                this.emit('delivery:completed', delivery);
            }

            this.queue.shift();
            this.stats.queueLength = this.queue.length;
        }

        this.processing = false;
    }

    async executeDelivery(delivery) {
        // This would spawn browser workers
        // For now, simulate with event emission for worker coordination
        this.emit('delivery:execute', delivery);
        
        // Wait for completion signal from workers
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Delivery timeout'));
            }, 3600000); // 1 hour max

            const onComplete = () => {
                clearTimeout(timeout);
                resolve();
            };

            const onFail = (err) => {
                clearTimeout(timeout);
                reject(err);
            };

            this.once(`delivery:${delivery.id}:complete`, onComplete);
            this.once(`delivery:${delivery.id}:fail`, onFail);
        });
    }

    cancelDelivery(deliveryId) {
        const delivery = this.queue.find(d => d.id === deliveryId);
        if (delivery) {
            delivery.status = 'cancelled';
            this.emit('delivery:cancelled', delivery);
            return true;
        }
        return false;
    }

    getStatus(deliveryId) {
        const delivery = this.queue.find(d => d.id === deliveryId);
        if (delivery) return delivery;
        
        // Check completed history (would be in separate store)
        return null;
    }

    getStats() {
        return {
            ...this.stats,
            queueLength: this.queue.length,
            activeDeliveries: this.queue.filter(d => d.status === 'active').length
        };
    }
}

// ============================================
// WEB DASHBOARD SERVER
// ============================================

function createDashboardServer(queue, accountManager, proxyRotator) {
    const express = require('express');
    const app = express();
    app.use(express.json());

    // CORS headers for dashboard
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });

    // Dashboard HTML
    app.get('/', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IG-BOT-NET Control Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #333;
        }
        .header h1 {
            font-size: 1.5rem;
            background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .status-badge {
            padding: 0.375rem 1rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
        }
        .status-online { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        .status-offline { background: rgba(237, 73, 86, 0.15); color: #ed4956; }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .card {
            background: #151515;
            border: 1px solid #222;
            border-radius: 12px;
            padding: 1.5rem;
        }
        
        .card-title {
            font-size: 0.875rem;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.75rem;
        }
        
        .card-value {
            font-size: 2rem;
            font-weight: 700;
            color: #fff;
        }
        
        .card-sub {
            font-size: 0.875rem;
            color: #666;
            margin-top: 0.5rem;
        }
        
        .section {
            background: #151515;
            border: 1px solid #222;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        
        .section-title {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .form-group { margin-bottom: 1rem; }
        .form-label {
            display: block;
            font-size: 0.875rem;
            color: #888;
            margin-bottom: 0.5rem;
        }
        .form-input {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s;
        }
        .form-input:focus { border-color: #0095f6; }
        
        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            font-size: 0.9375rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }
        .btn-primary {
            background: linear-gradient(45deg, #f09433, #e6683c, #dc2743);
            color: white;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-secondary {
            background: #222;
            color: #fff;
            border: 1px solid #333;
        }
        .btn-secondary:hover { background: #333; }
        
        .queue-list {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .queue-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: #0a0a0a;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border: 1px solid #222;
        }
        
        .queue-item-info { flex: 1; }
        .queue-item-user { font-weight: 600; color: #fff; }
        .queue-item-meta { font-size: 0.875rem; color: #666; }
        
        .queue-item-status {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .status-pending { background: rgba(243, 156, 18, 0.15); color: #f39c12; }
        .status-active { background: rgba(0, 149, 246, 0.15); color: #0095f6; }
        .status-completed { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        .status-failed { background: rgba(237, 73, 86, 0.15); color: #ed4956; }
        
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #222;
            border-radius: 3px;
            overflow: hidden;
            margin-top: 0.5rem;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #f09433, #e6683c);
            border-radius: 3px;
            transition: width 0.3s;
        }
        
        .log-container {
            background: #0a0a0a;
            border-radius: 8px;
            padding: 1rem;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.8125rem;
            line-height: 1.6;
        }
        .log-entry { margin-bottom: 0.25rem; }
        .log-time { color: #666; }
        .log-info { color: #0095f6; }
        .log-success { color: #2ecc71; }
        .log-error { color: #ed4956; }
        .log-warn { color: #f39c12; }
        
        .accounts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1rem;
        }
        
        .account-card {
            background: #0a0a0a;
            border: 1px solid #222;
            border-radius: 8px;
            padding: 1rem;
        }
        .account-name { font-weight: 600; margin-bottom: 0.25rem; }
        .account-status {
            display: inline-block;
            padding: 0.125rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            margin-bottom: 0.5rem;
        }
        .account-actions { font-size: 0.875rem; color: #666; }
        
        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .grid { grid-template-columns: 1fr; }
            .header { flex-direction: column; gap: 1rem; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IG-BOT-NET Control Dashboard</h1>
            <span class="status-badge status-online" id="serverStatus">ONLINE</span>
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-title">Queue Length</div>
                <div class="card-value" id="statQueue">0</div>
                <div class="card-sub">Active deliveries waiting</div>
            </div>
            <div class="card">
                <div class="card-title">Total Delivered</div>
                <div class="card-value" id="statDelivered">0</div>
                <div class="card-sub">Followers successfully sent</div>
            </div>
            <div class="card">
                <div class="card-title">Active Accounts</div>
                <div class="card-value" id="statAccounts">0</div>
                <div class="card-sub">Bot accounts available</div>
            </div>
            <div class="card">
                <div class="card-title">Success Rate</div>
                <div class="card-value" id="statRate">0%</div>
                <div class="card-sub">Delivery success ratio</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                New Delivery
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 1rem; align-items: end;">
                <div class="form-group">
                    <label class="form-label">Target Username</label>
                    <input type="text" class="form-input" id="targetUser" placeholder="@username" autocomplete="off">
                </div>
                <div class="form-group">
                    <label class="form-label">Follower Count</label>
                    <input type="number" class="form-input" id="followerCount" placeholder="100" min="1" max="10000" value="100">
                </div>
                <button class="btn btn-primary" onclick="submitDelivery()" style="height: fit-content;">
                    Launch Delivery
                </button>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Active Queue
            </div>
            <div class="queue-list" id="queueList">
                <div style="text-align: center; color: #666; padding: 2rem;">No active deliveries</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Bot Accounts
            </div>
            <div class="accounts-grid" id="accountsGrid">
                <!-- Populated by JS -->
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                System Logs
            </div>
            <div class="log-container" id="logContainer">
                <div class="log-entry"><span class="log-time">[${new Date().toLocaleTimeString()}]</span> <span class="log-info">System initialized</span></div>
            </div>
        </div>
    </div>
    
    <script>
        const API_BASE = window.location.origin;
        let logs = [];
        
        function addLog(level, message) {
            const time = new Date().toLocaleTimeString();
            logs.push({ time, level, message });
            if (logs.length > 100) logs.shift();
            
            const container = document.getElementById('logContainer');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = '<span class="log-time">[' + time + ']</span> <span class="log-' + level + '">' + message + '</span>';
            container.appendChild(entry);
            container.scrollTop = container.scrollHeight;
        }
        
        async function submitDelivery() {
            const username = document.getElementById('targetUser').value.replace('@', '').trim();
            const count = parseInt(document.getElementById('followerCount').value);
            
            if (!username) {
                addLog('error', 'Username required');
                return;
            }
            
            try {
                const res = await fetch(API_BASE + '/api/deliver', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, count })
                });
                
                const data = await res.json();
                if (data.success) {
                    addLog('success', 'Delivery queued: ' + username + ' (' + count + ' followers)');
                    document.getElementById('targetUser').value = '';
                } else {
                    addLog('error', data.error || 'Failed to queue delivery');
                }
            } catch (err) {
                addLog('error', 'Network error: ' + err.message);
            }
        }
        
        async function updateStats() {
            try {
                const res = await fetch(API_BASE + '/api/stats');
                const data = await res.json();
                
                document.getElementById('statQueue').textContent = data.queueLength;
                document.getElementById('statDelivered').textContent = data.totalDelivered.toLocaleString();
                document.getElementById('statAccounts').textContent = data.activeAccounts;
                document.getElementById('statRate').textContent = data.successRate + '%';
                
                // Update queue list
                const queueList = document.getElementById('queueList');
                if (data.deliveries && data.deliveries.length > 0) {
                    queueList.innerHTML = data.deliveries.map(d => {
                        const progress = d.followerCount > 0 ? (d.delivered / d.followerCount * 100) : 0;
                        const statusClass = 'status-' + d.status;
                        return '<div class="queue-item">' +
                            '<div class="queue-item-info">' +
                                '<div class="queue-item-user">@' + d.targetUsername + '</div>' +
                                '<div class="queue-item-meta">' + d.delivered + '/' + d.followerCount + ' followers</div>' +
                                '<div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%"></div></div>' +
                            '</div>' +
                            '<span class="queue-item-status ' + statusClass + '">' + d.status + '</span>' +
                        '</div>';
                    }).join('');
                } else {
                    queueList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No active deliveries</div>';
                }
                
                // Update accounts
                const accountsGrid = document.getElementById('accountsGrid');
                if (data.accounts && data.accounts.length > 0) {
                    accountsGrid.innerHTML = data.accounts.map(a => {
                        const statusColor = a.status === 'active' ? '#2ecc71' : '#ed4956';
                        return '<div class="account-card">' +
                            '<div class="account-name">' + a.username + '</div>' +
                            '<span class="account-status" style="background: ' + statusColor + '20; color: ' + statusColor + ';">' + a.status + '</span>' +
                            '<div class="account-actions">Daily: ' + (a.dailyActions || 0) + ' | Total: ' + (a.totalActions || 0) + '</div>' +
                        '</div>';
                    }).join('');
                }
            } catch (err) {
                document.getElementById('serverStatus').textContent = 'OFFLINE';
                document.getElementById('serverStatus').className = 'status-badge status-offline';
            }
        }
        
        // Poll every 2 seconds
        setInterval(updateStats, 2000);
        updateStats();
    </script>
</body>
</html>
        `);
    });

    // API Endpoints
    app.post('/api/deliver', (req, res) => {
        const { username, count, priority = 'normal' } = req.body;
        
        if (!username || !count || count < 1 || count > 10000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid username or count (1-10000)' 
            });
        }

        const deliveryId = queue.addDelivery(username, count, priority);
        
        res.json({ 
            success: true, 
            deliveryId,
            message: `Delivery queued for @${username}`
        });
    });

    app.get('/api/stats', (req, res) => {
        res.json({
            ...queue.getStats(),
            deliveries: queue.queue.map(d => ({
                id: d.id,
                targetUsername: d.targetUsername,
                followerCount: d.followerCount,
                delivered: d.delivered,
                status: d.status,
                priority: d.priority
            })),
            accounts: accountManager.accounts.map(a => ({
                username: a.username,
                status: a.status,
                dailyActions: a.dailyActions,
                totalActions: a.totalActions
            })),
            proxyCount: proxyRotator.proxies.length,
            successRate: queue.stats.totalDelivered > 0 
                ? ((queue.stats.totalDelivered / (queue.stats.totalDelivered + queue.stats.totalFailed)) * 100).toFixed(1)
                : 0
        });
    });

    app.get('/api/delivery/:id', (req, res) => {
        const delivery = queue.getStatus(req.params.id);
        if (!delivery) {
            return res.status(404).json({ error: 'Delivery not found' });
        }
        res.json(delivery);
    });

    app.listen(CONFIG.dashboardPort, () => {
        console.log(`[Dashboard] Running on http://localhost:${CONFIG.dashboardPort}`);
    });
}

// ============================================
// MAIN SERVER INITIALIZATION
// ============================================

async function main() {
    // Ensure directories exist
    [CONFIG.databasePath, CONFIG.logsPath].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Initialize components
    const proxyRotator = new ProxyRotator(path.join(__dirname, 'proxies.txt'));
    const accountManager = new AccountManager(CONFIG.databasePath);
    const deliveryQueue = new DeliveryQueue();

    // Reset daily counters on startup
    accountManager.resetDailyCounters();

    // Schedule daily reset
    setInterval(() => {
        accountManager.resetDailyCounters();
    }, 86400000);

    // Start dashboard
    createDashboardServer(deliveryQueue, accountManager, proxyRotator);

    // Worker pool for browser automation
    const workers = [];
    for (let i = 0; i < CONFIG.workerCount; i++) {
        // In production, these would be actual worker threads
        // For this architecture, we simulate worker coordination
        console.log(`[WorkerPool] Worker ${i + 1}/${CONFIG.workerCount} initialized`);
    }

    // Handle delivery execution events
    deliveryQueue.on('delivery:execute', async (delivery) => {
        console.log(`[Delivery] Executing ${delivery.id} for @${delivery.targetUsername}`);
        
        // This is where browser automation workers would be spawned
        // The actual implementation is in the worker script below
        
        // Simulate delivery for architecture demonstration
        const batchSize = 5;
        const batches = Math.ceil(delivery.followerCount / batchSize);
        
        for (let i = 0; i < batches; i++) {
            if (delivery.status === 'cancelled') break;
            
            const account = accountManager.getAvailableAccount();
            if (!account) {
                await jitterSleep(5000);
                i--; // Retry this batch
                continue;
            }

            try {
                // In production: spawn browser worker here
                // await spawnBrowserWorker(account, delivery.targetUsername);
                
                delivery.delivered += Math.min(batchSize, delivery.followerCount - delivery.delivered);
                accountManager.incrementActions(account.username);
                
                // Release account with cooldown
                accountManager.releaseAccount(account.username);
                accountManager.setCooldown(account.username, secureRandom(30000, 120000));
                
                delivery.logs.push({
                    time: new Date().toISOString(),
                    level: 'info',
                    message: `Batch ${i + 1}/${batches} delivered via ${account.username}`
                });

                deliveryQueue.emit('delivery:update', delivery);
                
                // Variable delay between actions
                await jitterSleep(CONFIG.actionDelayMin, CONFIG.actionDelayMax);
                
            } catch (err) {
                delivery.failed += batchSize;
                accountManager.markInvalid(account.username, err.message);
                accountManager.releaseAccount(account.username);
                
                delivery.logs.push({
                    time: new Date().toISOString(),
                    level: 'error',
                    message: `Batch ${i + 1} failed: ${err.message}`
                });
            }
        }

        // Signal completion
        if (delivery.status !== 'cancelled') {
            deliveryQueue.emit(`delivery:${delivery.id}:complete`);
        }
    });

    // Console command interface
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           IG-BOT-NET Control Server v2.1.0                   ║
║                                                              ║
║  Commands:                                                   ║
║    deliver <username> <count>  - Queue new delivery        ║
║    status                      - Show system status          ║
║    accounts                    - List bot accounts           ║
║    addacc <user> <pass>        - Add bot account             ║
║    proxies                     - Show proxy status           ║
║    quit                        - Shutdown server             ║
╚══════════════════════════════════════════════════════════════╝
    `);

    rl.on('line', (line) => {
        const args = line.trim().split(' ');
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case 'deliver': {
                const username = args[1];
                const count = parseInt(args[2]);
                if (!username || !count) {
                    console.log('Usage: deliver <username> <count>');
                    return;
                }
                const id = deliveryQueue.addDelivery(username, count);
                console.log(`[Command] Delivery queued: ${id}`);
                break;
            }
            case 'status': {
                const stats = deliveryQueue.getStats();
                console.log(`Queue: ${stats.queueLength} | Delivered: ${stats.totalDelivered} | Failed: ${stats.totalFailed}`);
                break;
            }
            case 'accounts': {
                console.log(`Active: ${accountManager.accounts.filter(a => a.status === 'active').length}/${accountManager.accounts.length}`);
                accountManager.accounts.forEach(a => {
                    console.log(`  ${a.username}: ${a.status} (daily: ${a.dailyActions || 0})`);
                });
                break;
            }
            case 'addacc': {
                const user = args[1];
                const pass = args[2];
                if (!user || !pass) {
                    console.log('Usage: addacc <username> <password>');
                    return;
                }
                accountManager.addAccount(user, pass, null, null);
                console.log(`[Command] Account added: ${user}`);
                break;
            }
            case 'proxies': {
                console.log(`Proxies: ${proxyRotator.proxies.length} loaded`);
                proxyRotator.proxies.forEach(p => {
                    const failures = proxyRotator.failureCounts.get(p.host) || 0;
                    console.log(`  ${p.host}:${p.port} (weight: ${p.weight.toFixed(2)}, failures: ${failures})`);
                });
                break;
            }
            case 'quit':
            case 'exit':
                console.log('[Server] Shutting down...');
                rl.close();
                process.exit(0);
                break;
            default:
                console.log('Unknown command. Type "help" for available commands.');
        }
    });

    console.log(`[Server] Control interface ready on port ${CONFIG.port}`);
    console.log(`[Server] Dashboard available at http://localhost:${CONFIG.dashboardPort}`);
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('[Fatal] Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('[Fatal] Unhandled rejection:', err);
});

// Start server
main().catch(console.error);
#!/usr/bin/env node
/**
 * IG-BOT-NET Account Warmup System v3.0
 * Multi-stage behavioral simulation engine for bot account maturation
 * Graduates accounts from passive observation to full follower deployment
 * Prevents pattern detection through organic action distribution
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const crypto = require('crypto');
const EventEmitter = require('events');

// ============================================
// CONFIGURATION ENGINE
// ============================================
const WARMUP_CONFIG = {
    // Maturation stages with escalating privileges
    stages: [
        {
            id: 'ghost',
            name: 'Ghost Phase',
            durationDays: 2,
            dailyActions: { min: 0, max: 3 },
            actionWeights: { scroll: 0.7, view_story: 0.2, search: 0.1 },
            followCap: 0,
            likeCap: 2,
            commentCap: 0,
            sessionCount: { min: 1, max: 2 },
            sessionDuration: { min: 180000, max: 600000 }, // 3-10 min
            bioProbability: 0.0,
            postProbability: 0.0,
            storyProbability: 0.0,
            dmProbability: 0.0
        },
        {
            id: 'observer',
            name: 'Observer Phase',
            durationDays: 4,
            dailyActions: { min: 5, max: 12 },
            actionWeights: { scroll: 0.5, view_story: 0.25, like: 0.15, search: 0.1 },
            followCap: 0,
            likeCap: 8,
            commentCap: 0,
            sessionCount: { min: 2, max: 4 },
            sessionDuration: { min: 300000, max: 900000 }, // 5-15 min
            bioProbability: 0.3,
            postProbability: 0.0,
            storyProbability: 0.1,
            dmProbability: 0.0
        },
        {
            id: 'lurker',
            name: 'Lurker Phase',
            durationDays: 5,
            dailyActions: { min: 12, max: 20 },
            actionWeights: { scroll: 0.35, view_story: 0.25, like: 0.2, search: 0.1, view_profile: 0.1 },
            followCap: 3,
            likeCap: 15,
            commentCap: 1,
            sessionCount: { min: 3, max: 5 },
            sessionDuration: { min: 420000, max: 1200000 }, // 7-20 min
            bioProbability: 0.6,
            postProbability: 0.1,
            storyProbability: 0.2,
            dmProbability: 0.0
        },
        {
            id: 'engager',
            name: 'Engager Phase',
            durationDays: 7,
            dailyActions: { min: 20, max: 35 },
            actionWeights: { scroll: 0.25, view_story: 0.2, like: 0.2, comment: 0.1, search: 0.1, view_profile: 0.1, save: 0.05 },
            followCap: 8,
            likeCap: 25,
            commentCap: 5,
            sessionCount: { min: 4, max: 6 },
            sessionDuration: { min: 600000, max: 1800000 }, // 10-30 min
            bioProbability: 0.8,
            postProbability: 0.2,
            storyProbability: 0.4,
            dmProbability: 0.05
        },
        {
            id: 'socialite',
            name: 'Socialite Phase',
            durationDays: 10,
            dailyActions: { min: 35, max: 55 },
            actionWeights: { scroll: 0.2, view_story: 0.15, like: 0.2, comment: 0.15, search: 0.1, view_profile: 0.1, save: 0.05, share: 0.05 },
            followCap: 15,
            likeCap: 40,
            commentCap: 10,
            sessionCount: { min: 5, max: 8 },
            sessionDuration: { min: 900000, max: 2400000 }, // 15-40 min
            bioProbability: 0.9,
            postProbability: 0.3,
            storyProbability: 0.5,
            dmProbability: 0.1
        },
        {
            id: 'veteran',
            name: 'Veteran Phase',
            durationDays: 9999,
            dailyActions: { min: 40, max: 80 },
            actionWeights: { scroll: 0.15, view_story: 0.15, like: 0.2, comment: 0.15, search: 0.1, view_profile: 0.1, save: 0.05, share: 0.05, dm: 0.05 },
            followCap: 25,
            likeCap: 60,
            commentCap: 15,
            sessionCount: { min: 6, max: 10 },
            sessionDuration: { min: 900000, max: 3600000 }, // 15-60 min
            bioProbability: 1.0,
            postProbability: 0.4,
            storyProbability: 0.6,
            dmProbability: 0.15
        }
    ],

    // Temporal distribution patterns (hour weights for action scheduling)
    hourlyDistribution: [
        0.01, 0.01, 0.01, 0.01, 0.02, 0.03,  // 00-05 (sleep hours, minimal)
        0.05, 0.08, 0.10, 0.12, 0.10, 0.08,  // 06-11 (morning commute/work)
        0.12, 0.10, 0.08, 0.07, 0.08, 0.10,  // 12-17 (afternoon peak)
        0.12, 0.10, 0.08, 0.06, 0.04, 0.02   // 18-23 (evening wind-down)
    ],

    // Weekly variation (multiplier per day, 0=Sunday)
    weeklyPattern: [0.7, 0.9, 1.0, 1.0, 1.0, 1.1, 1.2], // Weekend spike

    // Content pools for organic behavior
    contentPools: {
        bios: [
            "Living my best life ✨", "Just here for the memes", "Travel addict 🌍",
            "Foodie & coffee lover ☕", "Fitness journey 💪", "Artist & dreamer 🎨",
            "Music is life 🎵", "Dog mom/dad 🐕", "Entrepreneur mindset 💼",
            "Nature photographer 📸", "Gamer 🎮", "Fashion enthusiast 👗",
            "Bookworm 📚", "Plant parent 🌱", "Beach vibes 🏖️", "City explorer 🏙️",
            "Minimalist living", "Self-care advocate", "Digital nomad 💻",
            "Always learning 📖", "Positive vibes only ✌️", "Creator & maker",
            "Night owl 🦉", "Morning person ☀️", "Adventure awaits 🏔️"
        ],
        comments: [
            "Love this! 🔥", "So inspiring ✨", "This is amazing!", "Great shot! 📸",
            "Absolutely beautiful", "Goals! 💯", "This made my day", "Stunning work",
            "Can't stop looking at this", "Perfection!", "So relatable 😂",
            "Need this in my life", "Beautiful composition", "The vibes are immaculate",
            "This is everything", "Obsessed with this", "Incredible detail",
            "You never miss!", "Saved this for later", "Sharing with my friends"
        ],
        hashtags: [
            "love", "instagood", "photooftheday", "fashion", "beautiful",
            "happy", "cute", "tbt", "like4like", "followme",
            "picoftheday", "follow", "me", "selfie", "summer",
            "art", "instadaily", "friends", "repost", "nature",
            "girl", "fun", "style", "smile", "food",
            "instalike", "family", "travel", "fitness", "igers"
        ],
        searchQueries: [
            "fashion trends 2026", "healthy recipes", "workout motivation",
            "travel destinations", "photography tips", "home decor ideas",
            "street style", "memes", "cat videos", "sunset photography",
            "coffee art", "minimalist design", "self care routine",
            "morning routine", "productivity hacks", "book recommendations",
            "music playlist", "skincare routine", "meal prep ideas",
            "interior design", "outfit ideas", "makeup tutorial",
            "dog training tips", "gardening ideas", "art inspiration"
        ]
    },

    // Geographic timezone pools for realistic scheduling
    timezonePools: [
        { zone: 'America/New_York', weight: 0.25, label: 'US East' },
        { zone: 'America/Los_Angeles', weight: 0.20, label: 'US West' },
        { zone: 'America/Chicago', weight: 0.10, label: 'US Central' },
        { zone: 'Europe/London', weight: 0.12, label: 'UK' },
        { zone: 'Europe/Paris', weight: 0.08, label: 'EU Central' },
        { zone: 'Asia/Tokyo', weight: 0.08, label: 'Japan' },
        { zone: 'Asia/Singapore', weight: 0.05, label: 'SE Asia' },
        { zone: 'Australia/Sydney', weight: 0.05, label: 'Australia' },
        { zone: 'America/Sao_Paulo', weight: 0.04, label: 'Brazil' },
        { zone: 'Asia/Dubai', weight: 0.03, label: 'UAE' }
    ],

    // Device fingerprint rotation pool
    deviceProfiles: [
        { name: 'iPhone 15 Pro', width: 393, height: 852, dpr: 3, ua: 'iPhone' },
        { name: 'iPhone 15 Pro Max', width: 430, height: 932, dpr: 3, ua: 'iPhone' },
        { name: 'iPhone 14', width: 390, height: 844, dpr: 3, ua: 'iPhone' },
        { name: 'Samsung S24 Ultra', width: 384, height: 824, dpr: 3.5, ua: 'Android' },
        { name: 'Samsung S24', width: 360, height: 780, dpr: 3, ua: 'Android' },
        { name: 'Pixel 8 Pro', width: 448, height: 998, dpr: 2.5, ua: 'Android' },
        { name: 'Pixel 8', width: 412, height: 915, dpr: 2.5, ua: 'Android' },
        { name: 'iPad Pro 12.9', width: 1024, height: 1366, dpr: 2, ua: 'iPad' }
    ],

    databasePath: path.join(__dirname, 'data'),
    logsPath: path.join(__dirname, 'logs', 'warmup'),
    statePath: path.join(__dirname, 'data', 'warmup-state.json'),
    maxConcurrentWarmups: 5,
    checkpointInterval: 300000 // Save state every 5 minutes
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Cryptographically secure random number generator
 */
function secureRandom(min, max) {
    const range = max - min + 1;
    const bytes = crypto.randomBytes(4);
    const randomValue = bytes.readUInt32LE(0);
    return min + (randomValue % range);
}

/**
 * Weighted random selection from array of objects with .weight property
 */
function weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
        random -= (item.weight || 1);
        if (random <= 0) return item;
    }
    
    return items[items.length - 1];
}

/**
 * Sleep with optional jitter
 */
function jitterSleep(baseMs, jitterPercent = 20) {
    const jitter = baseMs * (jitterPercent / 100);
    const delay = baseMs + secureRandom(-Math.floor(jitter), Math.floor(jitter));
    return new Promise(r => setTimeout(r, Math.max(0, delay)));
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Get current timestamp in ISO format
 */
function now() {
    return new Date().toISOString();
}

// ============================================
// PERSISTENT STATE MANAGER
// ============================================

class StateManager {
    constructor(statePath) {
        this.statePath = statePath;
        this.state = this.load();
        this.dirty = false;
        this.initAutosave();
    }

    load() {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = fs.readFileSync(this.statePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (err) {
            console.error(`[StateManager] Load failed: ${err.message}`);
        }
        
        return {
            version: '3.0',
            createdAt: now(),
            updatedAt: now(),
            accounts: {},
            globalStats: {
                totalWarmupsCompleted: 0,
                totalActionsSimulated: 0,
                totalAccountsGraduated: 0,
                totalRuntimeMs: 0
            },
            checkpoints: []
        };
    }

    save() {
        try {
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            this.state.updatedAt = now();
            fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
            this.dirty = false;
            return true;
        } catch (err) {
            console.error(`[StateManager] Save failed: ${err.message}`);
            return false;
        }
    }

    initAutosave() {
        setInterval(() => {
            if (this.dirty) this.save();
        }, WARMUP_CONFIG.checkpointInterval);
    }

    getAccountState(username) {
        return this.state.accounts[username] || null;
    }

    setAccountState(username, accountState) {
        this.state.accounts[username] = accountState;
        this.dirty = true;
    }

    updateGlobalStats(updates) {
        Object.assign(this.state.globalStats, updates);
        this.dirty = true;
    }

    addCheckpoint(data) {
        this.state.checkpoints.push({
            time: now(),
            ...data
        });
        // Keep only last 100 checkpoints
        if (this.state.checkpoints.length > 100) {
            this.state.checkpoints = this.state.checkpoints.slice(-100);
        }
        this.dirty = true;
    }

    getStats() {
        return {
            ...this.state.globalStats,
            activeAccounts: Object.keys(this.state.accounts).length,
            lastCheckpoint: this.state.checkpoints[this.state.checkpoints.length - 1] || null
        };
    }
}

// ============================================
// BEHAVIORAL SCHEDULE GENERATOR
// ============================================

class ScheduleGenerator {
    constructor(config) {
        this.config = config;
    }

    /**
     * Generate a complete daily behavioral schedule for an account
     */
    generateDailySchedule(account, stage, timezone) {
        const actionCount = secureRandom(stage.dailyActions.min, stage.dailyActions.max);
        const sessionCount = secureRandom(stage.sessionCount.min, stage.sessionCount.max);
        
        // Distribute actions across sessions
        const actionsPerSession = this.distributeActions(actionCount, sessionCount);
        
        // Generate session start times based on timezone and hourly distribution
        const sessionStarts = this.generateSessionTimes(sessionCount, timezone);
        
        const sessions = [];
        let actionIndex = 0;
        
        for (let i = 0; i < sessionCount; i++) {
            const sessionActions = [];
            const sessionDuration = secureRandom(stage.sessionDuration.min, stage.sessionDuration.max);
            const actionCountForSession = actionsPerSession[i];
            
            // Generate actions within session with realistic timing
            const actionInterval = sessionDuration / (actionCountForSession + 1);
            
            for (let j = 0; j < actionCountForSession; j++) {
                const actionType = this.selectActionType(stage.actionWeights);
                const actionTime = new Date(sessionStarts[i].getTime() + (actionInterval * (j + 1)));
                const jitter = secureRandom(-30000, 30000); // ±30s jitter
                
                sessionActions.push({
                    id: crypto.randomUUID(),
                    type: actionType,
                    scheduledTime: new Date(actionTime.getTime() + jitter),
                    duration: this.estimateActionDuration(actionType),
                    target: this.generateActionTarget(actionType),
                    completed: false,
                    executedAt: null,
                    result: null
                });
                
                actionIndex++;
            }
            
            sessions.push({
                id: crypto.randomUUID(),
                startTime: sessionStarts[i],
                duration: sessionDuration,
                actions: sessionActions,
                completed: false,
                deviceProfile: weightedRandom(this.config.deviceProfiles)
            });
        }
        
        // Calculate day boundaries in account's timezone
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        const parts = formatter.formatToParts(today);
        const dateStr = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
        
        return {
            date: dateStr,
            timezone,
            stage: stage.id,
            totalActions: actionCount,
            sessions,
            metadata: {
                generatedAt: now(),
                weeklyMultiplier: this.config.weeklyPattern[new Date().getDay()]
            }
        };
    }

    /**
     * Distribute total actions across sessions with natural variance
     */
    distributeActions(total, sessions) {
        if (sessions === 1) return [total];
        
        const distribution = [];
        let remaining = total;
        
        for (let i = 0; i < sessions - 1; i++) {
            const avg = remaining / (sessions - i);
            const variance = Math.floor(avg * 0.4); // 40% variance
            const count = Math.max(1, avg + secureRandom(-variance, variance));
            distribution.push(count);
            remaining -= count;
        }
        
        distribution.push(Math.max(1, remaining));
        return distribution;
    }

    /**
     * Generate session start times using weighted hourly distribution
     */
    generateSessionTimes(sessionCount, timezone) {
        const times = [];
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        
        // Convert to account's timezone for accurate scheduling
        const tzOffset = this.getTimezoneOffset(timezone);
        const localDayStart = new Date(dayStart.getTime() + tzOffset);
        
        // Weighted random selection of hours
        const selectedHours = [];
        const availableHours = Array.from({ length: 24 }, (_, i) => i);
        
        for (let i = 0; i < sessionCount; i++) {
            // Weighted selection without replacement for first 3, then with replacement
            const pool = i < 3 ? availableHours.filter(h => !selectedHours.includes(h)) : availableHours;
            const hour = this.weightedHourSelection(pool);
            selectedHours.push(hour);
            
            const minute = secureRandom(0, 59);
            const second = secureRandom(0, 59);
            
            const sessionTime = new Date(localDayStart);
            sessionTime.setHours(hour, minute, second);
            
            // Convert back to UTC for storage
            times.push(new Date(sessionTime.getTime() - tzOffset));
        }
        
        return times.sort((a, b) => a - b);
    }

    /**
     * Select hour based on hourly distribution weights
     */
    weightedHourSelection(availableHours) {
        const weights = availableHours.map(h => this.config.hourlyDistribution[h]);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < availableHours.length; i++) {
            random -= weights[i];
            if (random <= 0) return availableHours[i];
        }
        
        return availableHours[availableHours.length - 1];
    }

    /**
     * Get timezone offset in milliseconds
     */
    getTimezoneOffset(timezone) {
        const now = new Date();
        const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        return local - utc;
    }

    /**
     * Select action type based on stage weights
     */
    selectActionType(weights) {
        const entries = Object.entries(weights);
        const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (const [type, weight] of entries) {
            random -= weight;
            if (random <= 0) return type;
        }
        
        return entries[entries.length - 1][0];
    }

    /**
     * Estimate realistic duration for action type
     */
    estimateActionDuration(actionType) {
        const durations = {
            scroll: { min: 15000, max: 60000 },
            view_story: { min: 3000, max: 15000 },
            like: { min: 2000, max: 5000 },
            comment: { min: 10000, max: 45000 },
            search: { min: 8000, max: 25000 },
            view_profile: { min: 5000, max: 20000 },
            save: { min: 2000, max: 4000 },
            share: { min: 3000, max: 8000 },
            dm: { min: 15000, max: 60000 },
            follow: { min: 3000, max: 8000 },
            unfollow: { min: 2000, max: 5000 }
        };
        
        const d = durations[actionType] || { min: 3000, max: 10000 };
        return secureRandom(d.min, d.max);
    }

    /**
     * Generate realistic target for action
     */
    generateActionTarget(actionType) {
        const pools = this.config.contentPools;
        
        switch (actionType) {
            case 'scroll':
                return {
                    feed: ['home', 'explore', 'reels'][secureRandom(0, 2)],
                    duration: secureRandom(10000, 60000),
                    scrollCount: secureRandom(5, 30)
                };
                
            case 'view_story':
                return {
                    username: `user_${secureRandom(1000, 999999)}`,
                    storyCount: secureRandom(1, 8),
                    interaction: Math.random() > 0.8 ? 'react' : 'view'
                };
                
            case 'like':
                return {
                    postId: crypto.randomUUID().slice(0, 8),
                    hashtag: weightedRandom(pools.hashtags.map(h => ({ value: h, weight: 1 }))).value,
                    source: ['feed', 'explore', 'hashtag', 'profile'][secureRandom(0, 3)]
                };
                
            case 'comment':
                return {
                    postId: crypto.randomUUID().slice(0, 8),
                    text: pools.comments[secureRandom(0, pools.comments.length - 1)],
                    hashtag: weightedRandom(pools.hashtags.map(h => ({ value: h, weight: 1 }))).value
                };
                
            case 'search':
                return {
                    query: pools.searchQueries[secureRandom(0, pools.searchQueries.length - 1)],
                    resultClicks: secureRandom(0, 3),
                    filter: ['top', 'recent', 'reels', 'accounts'][secureRandom(0, 3)]
                };
                
            case 'view_profile':
                return {
                    username: `${pools.hashtags[secureRandom(0, pools.hashtags.length - 1)]}_fan_${secureRandom(1, 9999)}`,
                    viewPosts: secureRandom(0, 6),
                    follow: Math.random() > 0.7
                };
                
            case 'save':
                return {
                    postId: crypto.randomUUID().slice(0, 8),
                    collection: ['Saved', 'Inspiration', 'Recipes', 'Outfits'][secureRandom(0, 3)]
                };
                
            case 'share':
                return {
                    postId: crypto.randomUUID().slice(0, 8),
                    method: ['story', 'dm', 'copy_link'][secureRandom(0, 2)]
                };
                
            case 'dm':
                return {
                    recipient: `user_${secureRandom(1000, 999999)}`,
                    messageLength: secureRandom(10, 100),
                    hasMedia: Math.random() > 0.8
                };
                
            case 'follow':
            case 'unfollow':
                return {
                    username: `target_${secureRandom(1000, 999999)}`,
                    source: ['suggested', 'search', 'explore', 'mutual'][secureRandom(0, 3)]
                };
                
            default:
                return { type: 'unknown' };
        }
    }
}

// ============================================
// ACCOUNT MATURATION TRACKER
// ============================================

class MaturationTracker {
    constructor(config) {
        this.config = config;
    }

    /**
     * Determine current maturation stage for account
     */
    getCurrentStage(account) {
        const created = new Date(account.createdAt || account.warmupStartedAt || Date.now());
        const daysSinceCreation = (Date.now() - created.getTime()) / 86400000;
        
        let accumulatedDays = 0;
        for (const stage of this.config.stages) {
            accumulatedDays += stage.durationDays;
            if (daysSinceCreation < accumulatedDays) {
                return stage;
            }
        }
        
        return this.config.stages[this.config.stages.length - 1];
    }

    /**
     * Calculate stage progress percentage
     */
    getStageProgress(account) {
        const created = new Date(account.createdAt || account.warmupStartedAt || Date.now());
        const daysSinceCreation = (Date.now() - created.getTime()) / 86400000;
        
        let accumulatedDays = 0;
        for (const stage of this.config.stages) {
            const stageStart = accumulatedDays;
            accumulatedDays += stage.durationDays;
            
            if (daysSinceCreation < accumulatedDays) {
                const stageProgress = (daysSinceCreation - stageStart) / stage.durationDays;
                return {
                    stage: stage.id,
                    stageName: stage.name,
                    overallProgress: Math.min(stageProgress * 100, 100),
                    daysInStage: daysSinceCreation - stageStart,
                    daysRemaining: accumulatedDays - daysSinceCreation,
                    totalDays: accumulatedDays,
                    isComplete: false
                };
            }
        }
        
        return {
            stage: 'veteran',
            stageName: 'Veteran Phase',
            overallProgress: 100,
            daysInStage: daysSinceCreation - this.getTotalWarmupDays(),
            daysRemaining: 0,
            totalDays: this.getTotalWarmupDays(),
            isComplete: true
        };
    }

    /**
     * Get total warmup duration in days
     */
    getTotalWarmupDays() {
        return this.config.stages.reduce((sum, s) => sum + s.durationDays, 0) - 9999; // Exclude veteran
    }

    /**
     * Check if account is ready for follower operations
     */
    isDeploymentReady(account) {
        const progress = this.getStageProgress(account);
        // Require at least lurker stage for follower deployment
        const minStageIndex = this.config.stages.findIndex(s => s.id === 'lurker');
        const currentStageIndex = this.config.stages.findIndex(s => s.id === progress.stage);
        return currentStageIndex >= minStageIndex;
    }

    /**
     * Get recommended daily action limits for account
     */
    getActionLimits(account) {
        const stage = this.getCurrentStage(account);
        return {
            follow: stage.followCap,
            like: stage.likeCap,
            comment: stage.commentCap,
            total: stage.dailyActions.max
        };
    }
}

// ============================================
// WARMUP EXECUTION ENGINE
// ============================================

class WarmupEngine extends EventEmitter {
    constructor(config, stateManager, scheduleGenerator, maturationTracker) {
        super();
        this.config = config;
        this.state = stateManager;
        this.scheduler = scheduleGenerator;
        this.tracker = maturationTracker;
        this.activeWarmups = new Map();
        this.isRunning = false;
        this.stats = {
            sessionsCompleted: 0,
            actionsCompleted: 0,
            errors: 0,
            startTime: null
        };
    }

    /**
     * Initialize warmup for a new account
     */
    async initializeAccount(account) {
        const username = account.username;
        
        // Check if already warming up
        if (this.activeWarmups.has(username)) {
            console.log(`[WarmupEngine] Account ${username} already in warmup`);
            return false;
        }
        
        // Assign timezone
        const timezone = weightedRandom(this.config.timezonePools).zone;
        
        // Create account state
        const accountState = {
            username,
            createdAt: account.createdAt || now(),
            warmupStartedAt: now(),
            timezone,
            currentStage: 'ghost',
            dailySchedules: [],
            completedActions: 0,
            completedSessions: 0,
            totalRuntimeMs: 0,
            status: 'warming_up',
            lastActivity: null,
            deviceRotation: [],
            profileConfigured: false,
            graduationDate: null
        };
        
        this.state.setAccountState(username, accountState);
        
        console.log(`[WarmupEngine] Initialized warmup for ${username} (${timezone})`);
        this.emit('account:initialized', { username, timezone });
        
        return true;
    }

    /**
     * Generate and queue tomorrow's schedule for account
     */
    async generateNextDaySchedule(username) {
        const accountState = this.state.getAccountState(username);
        if (!accountState) {
            throw new Error(`Account ${username} not found in warmup state`);
        }
        
        const stage = this.tracker.getCurrentStage(accountState);
        const schedule = this.scheduler.generateDailySchedule(
            accountState,
            stage,
            accountState.timezone
        );
        
        // Store schedule
        accountState.dailySchedules.push(schedule);
        
        // Keep only last 14 days of schedules
        if (accountState.dailySchedules.length > 14) {
            accountState.dailySchedules = accountState.dailySchedules.slice(-14);
        }
        
        this.state.setAccountState(username, accountState);
        
        console.log(`[WarmupEngine] Generated schedule for ${username}: ${schedule.totalActions} actions across ${schedule.sessions.length} sessions`);
        
        return schedule;
    }

    /**
     * Execute a single warmup session
     */
    async executeSession(username, session) {
        const accountState = this.state.getAccountState(username);
        const startTime = Date.now();
        
        console.log(`[WarmupEngine] Starting session for ${username} with ${session.actions.length} actions`);
        
        this.emit('session:started', { username, sessionId: session.id, actionCount: session.actions.length });
        
        // Simulate session with realistic timing
        for (const action of session.actions) {
            const actionStart = Date.now();
            
            try {
                // Wait until scheduled time if future
                const waitTime = action.scheduledTime.getTime() - Date.now();
                if (waitTime > 0) {
                    await jitterSleep(waitTime, 10);
                }
                
                // Execute action (simulated - would integrate with browser worker)
                const result = await this.simulateAction(username, action, session.deviceProfile);
                
                action.completed = true;
                action.executedAt = now();
                action.result = result;
                
                accountState.completedActions++;
                this.stats.actionsCompleted++;
                
                this.emit('action:completed', { username, action: action.type, result });
                
                // Variable delay between actions
                const nextAction = session.actions[session.actions.indexOf(action) + 1];
                if (nextAction) {
                    const gap = nextAction.scheduledTime.getTime() - action.scheduledTime.getTime();
                    const adjustedGap = Math.max(1000, gap - (Date.now() - actionStart));
                    await jitterSleep(adjustedGap, 15);
                }
                
            } catch (err) {
                action.completed = false;
                action.result = { error: err.message };
                this.stats.errors++;
                
                console.error(`[WarmupEngine] Action failed for ${username}: ${err.message}`);
                this.emit('action:failed', { username, action: action.type, error: err.message });
                
                // Brief pause after error
                await jitterSleep(5000, 50);
            }
        }
        
        session.completed = true;
        accountState.completedSessions++;
        accountState.lastActivity = now();
        accountState.totalRuntimeMs += (Date.now() - startTime);
        
        this.state.setAccountState(username, accountState);
        this.stats.sessionsCompleted++;
        
        this.emit('session:completed', { username, sessionId: session.id, duration: Date.now() - startTime });
        
        return true;
    }

    /**
     * Simulate Instagram action (placeholder for browser integration)
     */
    async simulateAction(username, action, deviceProfile) {
        // This method would integrate with Puppeteer browser worker
        // For warmup simulation, we log and sleep for estimated duration
        
        const duration = action.duration || 5000;
        
        // Log action
        const logEntry = {
            time: now(),
            username,
            action: action.type,
            target: action.target,
            device: deviceProfile.name,
            duration
        };
        
        this.appendLog(logEntry);
        
        // Simulate execution time with variance
        await jitterSleep(duration, 25);
        
        return {
            success: true,
            simulated: true,
            duration,
            timestamp: now()
        };
    }

    /**
     * Append to warmup action log
     */
    appendLog(entry) {
        const logPath = path.join(this.config.logsPath, 'actions.jsonl');
        const dir = path.dirname(logPath);
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
    }

    /**
     * Process daily warmup cycle for all accounts
     */
    async processDailyCycle() {
        const accounts = Object.keys(this.state.state.accounts);
        
        console.log(`[WarmupEngine] Processing daily cycle for ${accounts.length} accounts`);
        
        for (const username of accounts) {
            const accountState = this.state.getAccountState(username);
            
            // Skip if account graduated or failed
            if (accountState.status !== 'warming_up') continue;
            
            // Check if account needs profile setup
            if (!accountState.profileConfigured) {
                await this.setupProfile(username);
            }
            
            // Generate schedule for today/tomorrow
            const today = new Date().toISOString().split('T')[0];
            const hasSchedule = accountState.dailySchedules.some(s => s.date === today);
            
            if (!hasSchedule) {
                await this.generateNextDaySchedule(username);
            }
            
            // Get today's schedule
            const todaySchedule = accountState.dailySchedules.find(s => s.date === today);
            
            if (todaySchedule && !todaySchedule.completed) {
                // Execute sessions
                for (const session of todaySchedule.sessions) {
                    if (!session.completed) {
                        await this.executeSession(username, session);
                    }
                }
                
                todaySchedule.completed = true;
                this.state.setAccountState(username, accountState);
            }
            
            // Check graduation
            await this.checkGraduation(username);
        }
    }

    /**
     * Setup initial profile for bot account
     */
    async setupProfile(username) {
        const accountState = this.state.getAccountState(username);
        const stage = this.tracker.getCurrentStage(accountState);
        
        // Randomly decide profile elements based on stage probability
        const profile = {};
        
        if (Math.random() < stage.bioProbability) {
            profile.bio = this.config.contentPools.bios[
                secureRandom(0, this.config.contentPools.bios.length - 1)
            ];
        }
        
        // Profile picture would be set via browser automation
        profile.hasAvatar = Math.random() > 0.3;
        
        accountState.profileConfigured = true;
        accountState.profile = profile;
        
        this.state.setAccountState(username, accountState);
        
        console.log(`[WarmupEngine] Profile configured for ${username}`);
        this.emit('profile:configured', { username, profile });
    }

    /**
     * Check if account has graduated to deployment-ready status
     */
    async checkGraduation(username) {
        const accountState = this.state.getAccountState(username);
        const progress = this.tracker.getStageProgress(accountState);
        
        if (progress.isComplete && accountState.status === 'warming_up') {
            accountState.status = 'graduated';
            accountState.graduationDate = now();
            
            this.state.setAccountState(username, accountState);
            this.state.updateGlobalStats({
                totalAccountsGraduated: this.state.state.globalStats.totalAccountsGraduated + 1
            });
            
            console.log(`[WarmupEngine] 🎓 ACCOUNT GRADUATED: ${username} (${accountState.completedActions} actions over ${formatDuration(accountState.totalRuntimeMs)})`);
            
            this.emit('account:graduated', { username, stats: accountState });
            
            // Remove from active warmups
            this.activeWarmups.delete(username);
            
            return true;
        }
        
        return false;
    }

    /**
     * Start the warmup engine main loop
     */
    async start() {
        if (this.isRunning) {
            console.log('[WarmupEngine] Already running');
            return;
        }
        
        this.isRunning = true;
        this.stats.startTime = Date.now();
        
        console.log('[WarmupEngine] Starting main loop');
        
        // Main loop - check every minute for scheduled sessions
        while (this.isRunning) {
            try {
                await this.processDailyCycle();
            } catch (err) {
                console.error('[WarmupEngine] Cycle error:', err.message);
                this.stats.errors++;
            }
            
            // Sleep until next check
            await jitterSleep(60000, 10); // 1 minute with jitter
        }
    }

    /**
     * Stop the warmup engine
     */
    stop() {
        console.log('[WarmupEngine] Stopping...');
        this.isRunning = false;
        this.state.save();
    }

    /**
     * Get current engine statistics
     */
    getStats() {
        const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        
        return {
            ...this.stats,
            runtime,
            runtimeFormatted: formatDuration(runtime),
            activeAccounts: this.activeWarmups.size,
            totalAccounts: Object.keys(this.state.state.accounts).length,
            graduatedAccounts: this.state.state.globalStats.totalAccountsGraduated
        };
    }

    /**
     * Force-check all accounts for graduation (admin command)
     */
    async forceGraduationCheck() {
        const accounts = Object.keys(this.state.state.accounts);
        let graduated = 0;
        
        for (const username of accounts) {
            if (await this.checkGraduation(username)) {
                graduated++;
            }
        }
        
        return { checked: accounts.length, graduated };
    }

    /**
     * Get detailed account warmup report
     */
    getAccountReport(username) {
        const accountState = this.state.getAccountState(username);
        if (!accountState) return null;
        
        const progress = this.tracker.getStageProgress(accountState);
        const limits = this.tracker.getActionLimits(accountState);
        
        return {
            username,
            status: accountState.status,
            stage: progress.stageName,
            progress: progress.overallProgress,
            daysInStage: Math.floor(progress.daysInStage),
            daysRemaining: Math.floor(progress.daysRemaining),
            totalActions: accountState.completedActions,
            totalSessions: accountState.completedSessions,
            runtime: formatDuration(accountState.totalRuntimeMs),
            actionLimits: limits,
            isDeploymentReady: this.tracker.isDeploymentReady(accountState),
            timezone: accountState.timezone,
            lastActivity: accountState.lastActivity,
            profile: accountState.profile || null
        };
    }
}

// ============================================
// WEB API SERVER FOR WARMUP MANAGEMENT
// ============================================

function createWarmupAPIServer(engine, stateManager, tracker) {
    const http = require('http');
    const url = require('url');
    
    const server = http.createServer(async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        
        try {
            switch (path) {
                case '/api/warmup/stats':
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        data: engine.getStats()
                    }));
                    break;
                    
                case '/api/warmup/accounts':
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        data: Object.keys(stateManager.state.accounts).map(u => ({
                            username: u,
                            status: stateManager.state.accounts[u].status,
                            stage: tracker.getStageProgress(stateManager.state.accounts[u]).stageName
                        }))
                    }));
                    break;
                    
                case '/api/warmup/account': {
                    const username = parsedUrl.query.username;
                    if (!username) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ success: false, error: 'Username required' }));
                        return;
                    }
                    const report = engine.getAccountReport(username);
                    res.writeHead(report ? 200 : 404);
                    res.end(JSON.stringify({
                        success: !!report,
                        data: report || { error: 'Account not found' }
                    }));
                    break;
                }
                
                case '/api/warmup/graduate': {
                    if (req.method !== 'POST') {
                        res.writeHead(405);
                        res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
                        return;
                    }
                    const result = await engine.forceGraduationCheck();
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, data: result }));
                    break;
                }
                
                default:
                    res.writeHead(404);
                    res.end(JSON.stringify({ success: false, error: 'Not found' }));
            }
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
    
    const port = process.env.WARMUP_API_PORT || 7779;
    server.listen(port, () => {
        console.log(`[WarmupAPI] Management API on port ${port}`);
    });
    
    return server;
}

// ============================================
// COMMAND LINE INTERFACE
// ============================================

function setupCLI(engine, stateManager, tracker) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'warmup> '
    });
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     IG-BOT-NET Warmup System v3.0 Command Interface          ║
║                                                              ║
║  Commands:                                                   ║
║    init <username>             - Initialize account warmup   ║
║    status [username]           - Show account/status         ║
║    schedule <username>         - Generate next schedule      ║
║    run                         - Start warmup engine         ║
║    stop                        - Stop warmup engine          ║
║    stats                       - Show global statistics      ║
║    graduate                    - Force graduation check      ║
║    export                      - Export state to file        ║
║    help                        - Show this help            ║
║    quit                        - Exit                        ║
╚══════════════════════════════════════════════════════════════╝
    `);
    
    rl.prompt();
    
    rl.on('line', async (line) => {
        const args = line.trim().split(' ');
        const cmd = args[0].toLowerCase();
        
        try {
            switch (cmd) {
                case 'init': {
                    const username = args[1];
                    if (!username) {
                        console.log('Usage: init <username>');
                        break;
                    }
                    await engine.initializeAccount({ username, createdAt: now() });
                    console.log(`Initialized warmup for ${username}`);
                    break;
                }
                
                case 'status': {
                    const username = args[1];
                    if (username) {
                        const report = engine.getAccountReport(username);
                        if (report) {
                            console.log(JSON.stringify(report, null, 2));
                        } else {
                            console.log(`Account ${username} not found`);
                        }
                    } else {
                        const stats = engine.getStats();
                        console.log(`Engine: ${stats.activeAccounts} active, ${stats.graduatedAccounts} graduated`);
                        console.log(`Runtime: ${stats.runtimeFormatted}`);
                        console.log(`Actions: ${stats.actionsCompleted} completed, ${stats.errors} errors`);
                    }
                    break;
                }
                
                case 'schedule': {
                    const username = args[1];
                    if (!username) {
                        console.log('Usage: schedule <username>');
                        break;
                    }
                    const schedule = await engine.generateNextDaySchedule(username);
                    console.log(`Generated: ${schedule.totalActions} actions, ${schedule.sessions.length} sessions`);
                    break;
                }
                
                case 'run': {
                    engine.start();
                    console.log('Warmup engine started');
                    break;
                }
                
                case 'stop': {
                    engine.stop();
                    console.log('Warmup engine stopped');
                    break;
                }
                
                case 'stats': {
                    console.log(JSON.stringify(engine.getStats(), null, 2));
                    break;
                }
                
                case 'graduate': {
                    const result = await engine.forceGraduationCheck();
                    console.log(`Checked ${result.checked} accounts, ${result.graduated} graduated`);
                    break;
                }
                
                case 'export': {
                    const exportPath = `warmup-export-${Date.now()}.json`;
                    fs.writeFileSync(exportPath, JSON.stringify(stateManager.state, null, 2));
                    console.log(`State exported to ${exportPath}`);
                    break;
                }
                
                case 'help':
                    console.log('See header for available commands');
                    break;
                    
                case 'quit':
                case 'exit':
                    engine.stop();
                    rl.close();
                    process.exit(0);
                    break;
                    
                default:
                    console.log('Unknown command. Type "help" for available commands.');
            }
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
        
        rl.prompt();
    });
}

// ============================================
// MAIN ENTRY POINT
// ============================================

async function main() {
    // Ensure directories
    [WARMUP_CONFIG.databasePath, WARMUP_CONFIG.logsPath].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    
    // Initialize components
    const stateManager = new StateManager(WARMUP_CONFIG.statePath);
    const scheduleGenerator = new ScheduleGenerator(WARMUP_CONFIG);
    const maturationTracker = new MaturationTracker(WARMUP_CONFIG);
    const warmupEngine = new WarmupEngine(
        WARMUP_CONFIG,
        stateManager,
        scheduleGenerator,
        maturationTracker
    );
    
    // Setup event listeners
    warmupEngine.on('account:graduated', (data) => {
        console.log(`[Event] Account graduated: ${data.username}`);
    });
    
    warmupEngine.on('action:completed', (data) => {
        // Real-time action tracking
    });
    
    // Start API server
    createWarmupAPIServer(warmupEngine, stateManager, maturationTracker);
    
    // Setup CLI
    setupCLI(warmupEngine, stateManager, maturationTracker);
    
    // Auto-start if accounts exist
    const accountCount = Object.keys(stateManager.state.accounts).length;
    if (accountCount > 0) {
        console.log(`[Main] Found ${accountCount} accounts in warmup state`);
        // Don't auto-start, let user decide
    }
}

// Handle signals
process.on('SIGTERM', () => {
    console.log('[Main] SIGTERM received, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Main] Interrupted');
    process.exit(0);
});

main().catch(err => {
    console.error('[Main] Fatal error:', err);
    process.exit(1);
});
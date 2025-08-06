#!/usr/bin/env node

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

interface Config {
    workspace: string;
    username: string;
    appPassword: string;
    excludeRepos?: string[];
}

interface Commit {
    repo: string;
    hash: string;
    message: string;
    date: string;
}

interface PullRequest {
    repo: string;
    id: number;
    title: string;
    state: string;
    created: string;
    merged: string;
}

interface Stats {
    commits: Record<string, Commit[]>;
    pullRequests: Record<string, PullRequest[]>;
}

interface DateRange {
    start: string;
    end: string;
}

interface BitbucketCommit {
    hash: string;
    date: string;
    message: string;
    author: {
        raw?: string;
        user?: {
            display_name: string;
        };
    };
}

interface BitbucketPR {
    id: number;
    title: string;
    state: string;
    created_on: string;
    updated_on: string;
    author: {
        display_name?: string;
        username?: string;
    };
}

interface BitbucketRepository {
    name: string;
}

interface BitbucketResponse<T> {
    values: T[];
}

class BitbucketAnalyzer {
    private baseUrl: string = 'https://api.bitbucket.org/2.0';
    private auth: string | null = null;
    private workspace: string | null = null;
    private repos: string[] = [];
    private stats: Stats;

    constructor() {
        this.stats = {
            commits: {},
            pullRequests: {}
        };
    }

    // Load configuration from file or environment
    loadConfig(): boolean {
        const configPath = path.join(process.cwd(), 'bitbucket-config.json');
        
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                const config: Config = JSON.parse(configData);
                this.workspace = config.workspace;
                this.auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
                return true;
            }
        } catch (error) {
            console.error('Error reading config file:', (error as Error).message);
        }

        // Try environment variables
        const username = process.env.BITBUCKET_USERNAME;
        const appPassword = process.env.BITBUCKET_APP_PASSWORD;
        const workspace = process.env.BITBUCKET_WORKSPACE;

        if (username && appPassword && workspace) {
            this.auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
            this.workspace = workspace;
            return true;
        }

        return false;
    }

    // Create sample config file
    createSampleConfig(): void {
        const sampleConfig: Config = {
            workspace: "your-workspace-name",
            username: "your-username",
            appPassword: "your-app-password",
            excludeRepos: ["repo-to-exclude"]
        };

        fs.writeFileSync('bitbucket-config.json', JSON.stringify(sampleConfig, null, 2));
        console.log('📝 Created sample config file: bitbucket-config.json');
        console.log('Please edit it with your Bitbucket credentials and workspace info.');
    }

    // Make API request
    private async makeRequest<T>(endpoint: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const options: https.RequestOptions = {
                hostname: 'api.bitbucket.org',
                path: endpoint,
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'User-Agent': 'BitbucketAnalyzer/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data) as T);
                        } catch (error) {
                            reject(new Error(`Parse error: ${(error as Error).message}`));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.end();
        });
    }

    // Get all repositories in the workspace
    async getRepositories(): Promise<string[]> {
        console.log('🔍 Fetching repositories...');
        const encodedWorkspace = encodeURIComponent(this.workspace!.toLowerCase());
        
        // Try with different page sizes for robustness
        const endpoints = [
            `/2.0/repositories/${encodedWorkspace}?pagelen=100`,
            `/2.0/repositories/${encodedWorkspace}?pagelen=50`,
            `/2.0/repositories/${encodedWorkspace}`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest<BitbucketResponse<BitbucketRepository>>(endpoint);
                this.repos = response.values.map(repo => repo.name);
                console.log(`📁 Found ${this.repos.length} repositories`);
                return this.repos;
            } catch (error) {
                // If this is the last endpoint to try, throw the error
                if (endpoint === endpoints[endpoints.length - 1]) {
                    throw new Error(`Failed to fetch repositories: ${(error as Error).message}`);
                }
                // Otherwise, continue to next endpoint
                continue;
            }
        }
        
        return [];
    }

    // Get date range for the past week
    private getDateRange(): DateRange {
        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        
        return {
            start: weekAgo.toISOString(),
            end: now.toISOString()
        };
    }

    // Fetch commits for a repository
    private async fetchCommits(repoName: string, dateRange: DateRange): Promise<number> {
        const encodedWorkspace = encodeURIComponent(this.workspace!.toLowerCase());
        const normalizedRepoName = repoName.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
        const encodedRepoName = encodeURIComponent(normalizedRepoName);
        
        // Try with pagelen first, then fallback without it if it fails
        const endpoints = [
            `/2.0/repositories/${encodedWorkspace}/${encodedRepoName}/commits?pagelen=50`,
            `/2.0/repositories/${encodedWorkspace}/${encodedRepoName}/commits`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest<BitbucketResponse<BitbucketCommit>>(endpoint);
                const commits = response.values.filter(commit => {
                    const commitDate = new Date(commit.date);
                    return commitDate >= new Date(dateRange.start) && commitDate <= new Date(dateRange.end);
                });

                commits.forEach(commit => {
                    const author = commit.author.raw || commit.author.user?.display_name || 'Unknown';
                    const authorKey = author.split('<')[0].trim();
                    
                    if (!this.stats.commits[authorKey]) {
                        this.stats.commits[authorKey] = [];
                    }
                    
                    this.stats.commits[authorKey].push({
                        repo: repoName,
                        hash: commit.hash.substring(0, 7),
                        message: commit.message.split('\n')[0],
                        date: commit.date
                    });
                });

                return commits.length;
            } catch (error) {
                // If this is the last endpoint to try, show the error
                if (endpoint === endpoints[endpoints.length - 1]) {
                    console.warn(`⚠️  Could not fetch commits for ${repoName}: ${(error as Error).message}`);
                    return 0;
                }
                // Otherwise, continue to next endpoint
                continue;
            }
        }
        
        return 0;
    }

    // Fetch pull requests for a repository
    private async fetchPullRequests(repoName: string, dateRange: DateRange): Promise<number> {
        const encodedWorkspace = encodeURIComponent(this.workspace!.toLowerCase());
        const normalizedRepoName = repoName.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
        const encodedRepoName = encodeURIComponent(normalizedRepoName);
        
        // Try different configurations, fetching only merged pull requests
        const endpoints = [
            `/2.0/repositories/${encodedWorkspace}/${encodedRepoName}/pullrequests?state=MERGED&pagelen=50`,
            `/2.0/repositories/${encodedWorkspace}/${encodedRepoName}/pullrequests?state=MERGED&pagelen=25`,
            `/2.0/repositories/${encodedWorkspace}/${encodedRepoName}/pullrequests?state=MERGED`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest<BitbucketResponse<BitbucketPR>>(endpoint);
                const prs = response.values.filter(pr => {
                    const createdDate = new Date(pr.created_on);
                    return createdDate >= new Date(dateRange.start) && createdDate <= new Date(dateRange.end);
                });

                prs.forEach(pr => {
                    const author = pr.author.display_name || pr.author.username || 'Unknown';
                    
                    if (!this.stats.pullRequests[author]) {
                        this.stats.pullRequests[author] = [];
                    }
                    
                    this.stats.pullRequests[author].push({
                        repo: repoName,
                        id: pr.id,
                        title: pr.title,
                        state: pr.state,
                        created: pr.created_on,
                        merged: pr.updated_on
                    });
                });

                return prs.length;
            } catch (error) {
                // If this is the last endpoint to try, show the error
                if (endpoint === endpoints[endpoints.length - 1]) {
                    console.warn(`⚠️  Could not fetch PRs for ${repoName}: ${(error as Error).message}`);
                    return 0;
                }
                // Otherwise, continue to next endpoint
                continue;
            }
        }
        
        return 0;
    }

    // Generate and display report
    private generateReport(): void {
        console.log('\n📊 BITBUCKET ACTIVITY REPORT - LAST 7 DAYS');
        console.log('='.repeat(60));

        // Commits summary
        console.log('\n🚀 COMMITS SUMMARY');
        console.log('-'.repeat(40));
        
        const commitAuthors = Object.keys(this.stats.commits);
        if (commitAuthors.length === 0) {
            console.log('No commits found in the last 7 days.');
        } else {
            commitAuthors
                .sort((a, b) => this.stats.commits[b].length - this.stats.commits[a].length)
                .forEach(author => {
                    const commits = this.stats.commits[author];
                    console.log(`📝 ${author}: ${commits.length} commits`);
                    
                    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
                        commits.forEach(commit => {
                            console.log(`    ${commit.hash} - ${commit.message} (${commit.repo})`);
                        });
                    }
                });
        }

        // Pull requests summary
        console.log('\n🔄 PULL REQUESTS SUMMARY');
        console.log('-'.repeat(40));
        
        const prAuthors = Object.keys(this.stats.pullRequests);
        if (prAuthors.length === 0) {
            console.log('No pull requests found in the last 7 days.');
        } else {
            prAuthors
                .sort((a, b) => this.stats.pullRequests[b].length - this.stats.pullRequests[a].length)
                .forEach(author => {
                    const prs = this.stats.pullRequests[author];
                    console.log(`🔀 ${author}: ${prs.length} pull requests`);
                    
                    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
                        prs.forEach(pr => {
                            console.log(`    #${pr.id} - ${pr.title} (${pr.repo})`);
                        });
                    }
                });
        }

        // Overall stats
        const totalCommits = Object.values(this.stats.commits).reduce((sum, commits) => sum + commits.length, 0);
        const totalPRs = Object.values(this.stats.pullRequests).reduce((sum, prs) => sum + prs.length, 0);
        
        console.log('\n📈 OVERALL STATS');
        console.log('-'.repeat(40));
        console.log(`Total Commits: ${totalCommits}`);
        console.log(`Total Pull Requests: ${totalPRs}`);
        console.log(`Active Contributors: ${new Set([...commitAuthors, ...prAuthors]).size}`);
        console.log(`Repositories Analyzed: ${this.repos.length}`);
    }

    // Main execution
    async run(): Promise<void> {
        console.log('🚀 Bitbucket Activity Analyzer Starting...\n');

        // Check for help flag
        if (process.argv.includes('--help') || process.argv.includes('-h')) {
            this.showHelp();
            return;
        }

        // Check for config creation flag
        if (process.argv.includes('--create-config')) {
            this.createSampleConfig();
            return;
        }

        // Load configuration
        if (!this.loadConfig()) {
            console.error('❌ Configuration not found!');
            console.log('Please either:');
            console.log('1. Create a config file: node bitbucket-analyzer.js --create-config');
            console.log('2. Set environment variables: BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD, BITBUCKET_WORKSPACE');
            process.exit(1);
        }

        console.log(`🏢 Analyzing workspace: ${this.workspace}`);

        try {
            // Get repositories
            await this.getRepositories();
            
            // Get date range
            const dateRange = this.getDateRange();
            console.log(`📅 Date range: ${dateRange.start.split('T')[0]} to ${dateRange.end.split('T')[0]}`);

            // Process each repository
            console.log('\n📊 Processing repositories...');
            let totalCommits = 0;
            let totalPRs = 0;

            for (const repo of this.repos) {
                process.stdout.write(`📁 ${repo}... `);
                
                const [commits, prs] = await Promise.all([
                    this.fetchCommits(repo, dateRange),
                    this.fetchPullRequests(repo, dateRange)
                ]);

                totalCommits += commits;
                totalPRs += prs;
                
                console.log(`${commits} commits, ${prs} PRs`);
                
                // Add small delay to respect rate limits
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }

            // Generate report
            this.generateReport();

        } catch (error) {
            console.error('❌ Error:', (error as Error).message);
            process.exit(1);
        }
    }

    private showHelp(): void {
        console.log(`
🚀 Bitbucket Activity Analyzer

USAGE:
  node bitbucket-analyzer.js [options]

OPTIONS:
  --help, -h           Show this help message
  --create-config      Create a sample configuration file
  --verbose, -v        Show detailed commit and PR information

CONFIGURATION:
  Create a bitbucket-config.json file with:
  {
    "workspace": "your-workspace-name",
    "username": "your-username", 
    "appPassword": "your-app-password"
  }

  Or set environment variables:
  - BITBUCKET_USERNAME
  - BITBUCKET_APP_PASSWORD  
  - BITBUCKET_WORKSPACE

BITBUCKET APP PASSWORD:
  1. Go to Bitbucket Settings > Personal Settings > App passwords
  2. Create new app password with 'Repositories: Read' permission
  3. Use this password in your configuration

EXAMPLES:
  node bitbucket-analyzer.js
  node bitbucket-analyzer.js --verbose
  node bitbucket-analyzer.js --create-config
        `);
    }
}

// Run the analyzer
if (require.main === module) {
    const analyzer = new BitbucketAnalyzer();
    analyzer.run().catch(console.error);
}

export default BitbucketAnalyzer;
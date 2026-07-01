import { ChildProcessWithoutNullStreams } from 'child_process';

export default class ZennVersion {

    public static create(version: string): ZennVersion {
        return new ZennVersion(version);
    }

    public static resolve(process: ChildProcessWithoutNullStreams): Promise<ZennVersion> {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            process.stdout.on('data', data => { stdout = stdout + data; });
            process.stderr.on('data', data => { stderr = stderr + data; });
            process.on('close', code => {
                if (code === 0) {
                    resolve(new ZennVersion(stdout.trim()));
                } else {
                    reject(new Error(`Cannot resolve version (exit code: ${code}): ${stderr}`));
                }
            });
        });
    }

    public readonly major: number;
    public readonly minor: number;
    public readonly patch: number;
    public readonly displayVersion: string;

    private constructor(version: string) {
        const normalized = version.match(/[0-9]+\.[0-9]+\.[0-9]+/);
        this.displayVersion = (normalized && normalized[0]) ? normalized[0] : '0.0.0';
        const [major, minor, patch] = this.displayVersion.split('.');
        this.major = parseInt(major, 10);
        this.minor = parseInt(minor, 10);
        this.patch = parseInt(patch, 10);
    }

    compare(other: ZennVersion): number {
        if (this.major !== other.major) return this.major > other.major ? 1 : -1;
        if (this.minor !== other.minor) return this.minor > other.minor ? 1 : -1;
        if (this.patch !== other.patch) return this.patch > other.patch ? 1 : -1;
        return 0;
    }

    toString(): string {
        return this.displayVersion;
    }
}

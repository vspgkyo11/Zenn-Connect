import { ChildProcessWithoutNullStreams } from 'child_process';
import * as readline from 'readline';
import psTree from 'ps-tree';
import * as process from 'process';
import Uri from '../util/uri';

export default class ZennPreview {

    public static create(port: number, childProcess: ChildProcessWithoutNullStreams, workingDirectory: Uri): Promise<ZennPreview> {
        const stdout = readline.createInterface(childProcess.stdout);
        const stderr = readline.createInterface(childProcess.stderr);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                try {
                    this.kill(childProcess);
                } finally {
                    reject(new Error('preview timeout'));
                }
            }, 10000);

            stdout.on('line', line => {
                console.log(line.toString());
                if (line.includes(`http://localhost:${port}`)) {
                    clearTimeout(timeout);
                    resolve(new ZennPreview(port, childProcess, workingDirectory));
                }
            });
            stderr.on('line', line => {
                console.log(line.toString());
            });
        });
    }

    private static kill(childProcess: ChildProcessWithoutNullStreams) {
        if (childProcess.pid === undefined) return;
        psTree(childProcess.pid, (error: Error | null, children: readonly psTree.PS[]) => {
            if (error) {
                console.error(error);
            } else {
                children.forEach((child: psTree.PS) => {
                    try {
                        process.kill(parseInt(child.PID, 10));
                    } catch (e) {
                        // すでに終了している場合は無視
                    }
                });
            }
        });
    }

    public readonly host: string;
    public readonly port: number;
    public readonly workingDirectory: Uri;

    private readonly process: ChildProcessWithoutNullStreams;

    private constructor(port: number, childProcess: ChildProcessWithoutNullStreams, workingDirectory: Uri) {
        this.host = '127.0.0.1';
        this.port = port;
        this.process = childProcess;
        this.workingDirectory = workingDirectory;
    }

    public onClose(listener: () => void): void {
        this.process.on('close', listener);
    }

    public close(): void {
        ZennPreview.kill(this.process);
    }
}

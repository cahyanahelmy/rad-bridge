import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

const execAsync = (command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> =>
  promisify(exec)(command, { windowsHide: true, ...options }) as any;

export class InfraService {
  private get runtime() {
    return config.container.runtime;
  }

  /**
   * Start DICOM Router container.
   */
  async startRouter() {
    return this.execContainerCommand('start');
  }

  /**
   * Stop DICOM Router container.
   */
  async stopRouter() {
    return this.execContainerCommand('stop');
  }

  /**
   * Restart DICOM Router container.
   */
  async restartRouter() {
    return this.execContainerCommand('restart');
  }

  /**
   * Get DICOM Router container status.
   */
  async getRouterStatus() {
    const containerName = config.dicomRouter.containerName;
    try {
      const { stdout } = await execAsync(
        `${this.runtime} inspect --format="{{.State.Status}}" ${containerName}`,
        { timeout: 10000 }
      );
      const status = stdout.trim().replace(/"/g, '');
      return { container: containerName, status, runtime: this.runtime };
    } catch (err: any) {
      return { container: containerName, status: 'not_found', runtime: this.runtime, error: err.message };
    }
  }

  /**
   * Get container logs.
   */
  async getRouterLogs(tail: number = 100) {
    const containerName = config.dicomRouter.containerName;
    try {
      const { stdout } = await execAsync(
        `${this.runtime} logs --tail ${tail} ${containerName}`,
        { timeout: 15000 }
      );
      return stdout;
    } catch (err: any) {
      return `Error fetching logs: ${err.message}`;
    }
  }

  /**
   * Check container runtime availability.
   */
  async checkRuntime() {
    try {
      const { stdout } = await execAsync(`${this.runtime} --version`, { timeout: 5000 });
      return { available: true, version: stdout.trim(), runtime: this.runtime };
    } catch {
      return { available: false, runtime: this.runtime };
    }
  }

  private async execContainerCommand(action: 'start' | 'stop' | 'restart') {
    const containerName = config.dicomRouter.containerName;
    const command = `${this.runtime} ${action} ${containerName}`;

    logger.info({ command }, `Container ${action}`);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      // Log infrastructure action
      await prisma.infrastructureLog.create({
        data: {
          service: 'dicom-router',
          action,
          status: 'success',
          details: stdout || stderr,
        },
      });

      return { success: true, action, container: containerName };
    } catch (err: any) {
      await prisma.infrastructureLog.create({
        data: {
          service: 'dicom-router',
          action,
          status: 'failed',
          details: err.message,
        },
      });

      return { success: false, action, container: containerName, error: err.message };
    }
  }
}

export const infraService = new InfraService();

import { OpenKitBuilder, OpenKit, Session } from '@dynatrace/openkit-js';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { getPackageJsonVersion } from './version';
import { logErrorObject, logger } from './logger';

export interface Telemetry {
  trackMcpServerStart(): Promise<void>;
  trackMcpToolUsage(toolName: string, success: boolean, duration?: number): Promise<void>;
  trackError(error: Error, context?: string): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Dynatrace OpenKit-based telemetry implementation for tracking MCP server usage and performance metrics.
 * Collects anonymous usage statistics, tool execution metrics, and error tracking for product improvement.
 *
 * Based on https://docs.dynatrace.com/docs/ingest-from/extend-dynatrace/openkit/instrument-your-application-using-dynatrace-openkit#openkit-basic-sample--javascript
 */
class DynatraceMcpTelemetry implements Telemetry {
  private openKit: OpenKit | null = null;
  private session?: Session;
  private _isEnabled: boolean;

  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  constructor() {
    this._isEnabled = process.env.DT_MCP_DISABLE_TELEMETRY !== 'true';
    if (!this._isEnabled) {
      logger.info('Not initialising Dynatrace Telemetry, because DT_MCP_DISABLE_TELEMETRY not "true"');
    }
  }

  async initializeOpenKit(): Promise<void> {
    if (!this._isEnabled) return;
    const applicationId = process.env.DT_MCP_TELEMETRY_APPLICATION_ID || '5e2dbb56-076b-412e-8ffc-7babb7ae7c5d';
    const endpointUrl = process.env.DT_MCP_TELEMETRY_ENDPOINT_URL || 'https://bf96767wvv.bf.dynatrace.com/mbeacon';
    // get anonymized device id
    const deviceId = process.env.DT_MCP_TELEMETRY_DEVICE_ID || this.generateDeviceId();
    try {
      logger.info(
        `Connecting Dynatrace Telemetry via ${endpointUrl}. You can disable this by setting DT_MCP_DISABLE_TELEMETRY=true.`,
      );

      this.openKit = new OpenKitBuilder(endpointUrl, applicationId, Number.parseInt(deviceId, 10))
        .withApplicationVersion(getPackageJsonVersion())
        .withOperatingSystem(`${os.platform()} ${os.release()}`)
        .withManufacturer('dynatrace-oss')
        .withModelId('dynatrace-managed-mcp-server')
        .build();

      return await new Promise<void>((resolve) => {
        const timeoutInMilliseconds = 10 * 1000; // 10 seconds timeout
        if (this.openKit === null) {
          logger.error('Failed to initialize Dynatrace Telemetry: OpenKit is null');
          this._isEnabled = false;
          resolve();
          return;
        }
        this.openKit.waitForInit((success) => {
          if (success) {
            this.session = this.openKit?.createSession();
            if (this.session === undefined) {
              logger.error('Failed to initialize session: OpenKit is null');
            }
          } else {
            logger.error('Failed to initialize Dynatrace Telemetry: timeout or connection failed');
            this._isEnabled = false;
          }
          resolve();
        }, timeoutInMilliseconds);
      });
    } catch (error) {
      logErrorObject(error, 'Failed to initialize Dynatrace Telemetry');
      console.error(
        'If the error persists, please consider disabling telemetry by setting DT_MCP_DISABLE_TELEMETRY=true.',
      );
      this._isEnabled = false;
    }
  }

  /**
   * Generates a random device identifier
   * @returns deviceId - a string containing number for OpenKit
   */
  private generateDeviceId(): string {
    // Generate a simple device ID based on hostname and some randomness
    const hostname = os.hostname();
    const random = crypto.randomBytes(8).toString('hex');
    const hash = crypto.createHash('md5').update(`${hostname}-${random}`).digest('hex');
    // Convert to a number (device ID must be a number for OpenKit)
    return Number.parseInt(hash.substring(0, 15), 16).toString();
  }

  /**
   * Track Server Start
   * @returns nothing
   */
  async trackMcpServerStart(): Promise<void> {
    if (!this.isEnabled) return;
    if (!this.session) return;

    try {
      const action = this.session.enterAction('mcp_server_start');
      action.reportEvent('server_started');
      action.reportValue('version', getPackageJsonVersion());
      action.reportValue('node_version', process.version);
      action.reportValue('platform', process.platform);
      action.leaveAction();
    } catch (error) {
      logErrorObject(error, 'Failed to track server start');
    }
  }

  /**
   * Track Tool Usage
   * @param toolName name of the tool
   * @param success whether or not the tool call was successful
   * @param duration duration of the tool call
   * @returns nothing
   */
  async trackMcpToolUsage(toolName: string, success: boolean, duration?: number): Promise<void> {
    if (!this.isEnabled) return;
    if (!this.session) return;

    try {
      const action = this.session.enterAction(`tool_${toolName}`);
      action.reportEvent(success ? 'tool_success' : 'tool_error');
      action.reportValue('tool_name', toolName);
      action.reportValue('success', success ? 'true' : 'false');

      if (duration !== undefined) {
        action.reportValue('duration_ms', duration);
      }

      action.leaveAction();
    } catch (error) {
      logErrorObject(error, 'Failed to track tool usage');
    }
  }

  /**
   * Track Errors
   * @param error error message to be tracked
   * @param context
   * @returns nothing
   */
  async trackError(error: Error, context?: string): Promise<void> {
    if (!this.isEnabled) return;
    if (!this.session) return;

    try {
      const action = this.session.enterAction('error_occurred');
      // reportError expects name and code, so we'll use error name and a generic error code
      action.reportError(error.name || 'Error', 500);

      if (context) {
        action.reportValue('error_context', context);
      }

      action.reportValue('error_message', error.message);
      if (error.stack) {
        action.reportValue('error_stack', error.stack.substring(0, 1000)); // Limit stack trace length
      }
      action.leaveAction();
    } catch (trackingError) {
      logErrorObject(trackingError, 'Failed to track error');
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      if (this.session) {
        this.session.end();
      }
      await new Promise<void>((resolve) => {
        if (this.openKit) {
          this.openKit.shutdown(() => resolve());
        } else {
          logger.warn('Could not shutdown OpenKit, value is null');
          resolve();
        }
      });
    } catch (error) {
      logErrorObject(error, 'Failed to shutdown usage tracking');
    }
  }
}

export async function createAndInitializeTelemetry(): Promise<Telemetry | undefined> {
  const telemetry = new DynatraceMcpTelemetry();
  await telemetry.initializeOpenKit();

  if (telemetry.isEnabled) {
    return telemetry;
  } else {
    return undefined;
  }
}

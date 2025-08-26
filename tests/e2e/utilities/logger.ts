export class TestLogger {
  constructor(private context: string) {}

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [${this.context}] ${message}`);
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  success(message: string): void {
    this.log('SUCCESS', `${message}`);
  }

  warn(message: string): void {
    this.log('WARN', `${message}`);
  }

  error(message: string): void {
    this.log('ERROR', `${message}`);
  }

  debug(message: string): void {
    this.log('DEBUG', `${message}`);
  }
}

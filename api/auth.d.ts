// Type contract for the JS handler module, so vite.config.ts can call it
// directly when serving /api/auth in dev.
export declare function GET(request: Request): Promise<Response>
export declare function POST(request: Request): Promise<Response>
export declare function DELETE(request?: Request): Promise<Response>

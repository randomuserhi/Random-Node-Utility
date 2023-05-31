import { core, Core } from "./core.cjs";

export interface WebSockets
{
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;

    ws: WebSockets.wsConstructor;

    wsClient: WebSockets.wsClientGenerator;
}

export interface WebSocketConstructor
{
    prototype: WebSocket;
    new(url: string | URL, protocols?: string | string[]): WebSocket;
}

export declare namespace WebSockets
{
    interface Options
    {
        url: string | URL;
        protocols?: string | string[];
    }

    interface ws extends WebSocket
    {
        queue: (string | ArrayBufferLike | Blob | ArrayBufferView)[];
    }
    interface wsConstructor extends WebSocketConstructor, Core.ReflectConstruct<WebSocketConstructor, wsConstructor>
    {
        readonly prototype: ws;
        new(url: string | URL, protocols?: string | string[]): ws;
    }

    interface wsClient<T extends WebSocket, Construct extends (...args: any[]) => WebSockets.Options> extends EventTarget
    {
        args: any[];
        ws: T;

        onclose: ((this: wsClient<T, Construct>, ev: CloseEvent) => any) | null;
        onerror: ((this: wsClient<T, Construct>, ev: Event) => any) | null;
        onmessage: ((this: wsClient<T, Construct>, ev: MessageEvent) => any) | null;
        onopen: ((this: wsClient<T, Construct>, ev: Event) => any) | null;

        reconnect(...args: Parameters<Construct>): void;
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
        close(code?: number, reason?: string): void;

        addEventListener<T extends keyof WebSocketEventMap>(type: T, listener: (this: WebSocket, ev: WebSocketEventMap[T]) => any, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
        removeEventListener<T extends keyof WebSocketEventMap>(type: T, listener: (this: WebSocket, ev: WebSocketEventMap[T]) => any, options?: boolean | EventListenerOptions): void;
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    }
    interface wsClientConstructor<T extends WebSocket, Construct extends (...args: any[]) => WebSockets.Options>
    {
        readonly prototype: wsClient<T, Construct>;
        new(...args: Parameters<Construct>): wsClient<T, Construct>;
    }

    interface wsClientGenerator
    {
        new<T extends WebSocketConstructor, Construct extends (...args: any[]) => WebSockets.Options>(webSocket: T, constructor: Construct): wsClientConstructor<T extends { prototype: infer Socket } ? Socket : never, Construct>;
    }
}

let webSockets: WebSockets = {} as WebSockets;

core.definePublicAccessors(webSockets, {
    CONNECTING: {
        get: function() { return WebSocket.CONNECTING; }
    },
    OPEN: {
        get: function() { return WebSocket.OPEN; }
    },
    CLOSING: {
        get: function() { return WebSocket.CLOSING; }
    },
    CLOSED: {
        get: function() { return WebSocket.CLOSED; }
    }
});

let ws: WebSockets.wsConstructor = core.reflectConstruct(WebSocket, "ws", 
function(this: WebSockets.ws, url: string | URL, protocols: string | string[] = [])
{
    /**
     * @property{public}    queue{List[String]}     List of enqueued messages to be sent.   
     */

    this.queue = [];

    this.addEventListener("open", () => {
        // Send messages in queue, NOTE(randomuserhi): A simple for loop can be used, but this
        //                                             just shows shift() function exists :)
        while (this.queue.length) 
            WebSocket.prototype.send.call(this, this.queue.shift());
    });
}) as WebSockets.wsConstructor;
ws.__args__ = function(url: string | URL, protocols: string | string[] = [])
{
    return [url, protocols];
};
ws.prototype.send = function(data)
{
    if (this.readyState === webSockets!.OPEN)
        WebSocket.prototype.send.call(this, data);
    else
        this.queue.push(data);
};
core.inherit(ws, WebSocket);
webSockets.ws = ws;

webSockets.wsClient = function<T extends WebSocketConstructor, Construct extends (...args: any[]) => WebSockets.Options>(webSocket: T, constructor: Construct)
{
    // Aliases for generic types
    type wsClient = WebSockets.wsClient<Socket<T>, Construct>;
    type wsClientConstructor = WebSockets.wsClientConstructor<Socket<T>, Construct>;
    
    // Utility to get socket type from WebSocketConstructor
    type Socket<T extends { prototype: any }> = T extends { prototype: infer Sock } ? Sock : never; 

    // NOTE(randomuserhi): Technically not needed, but I think using new keyword makes the syntax nicer.
    if (new.target === undefined) throw new TypeError("Constructor Component requires 'new'.");
    
    if (WebSocket as WebSocketConstructor !== webSocket && !Object.isPrototypeOf.call(WebSocket, webSocket)) 
        throw new TypeError("WebSocket must be inherited from or of type 'WebSocket'.");

    // TODO(randomuserhi): Documentation...
    let construct = function(this: wsClient, ...args: any[])
    {
        // TODO(randomuserhi): Not sure about saving args like this, seems dodgy way of handling reconnect
        this.args = args;

        core.eventTarget.call(this);

        let params: WebSockets.Options = {
            url: "",
            protocols: []
        };
        core.parseOptions(params, constructor.call(this, ...args));
        this.ws = new webSocket(params.url, params.protocols) as Socket<T>;

        this.ws.addEventListener("close", (e) => { this.dispatchEvent(core.CustomEvent("close", e)); if (core.exists(this.onclose)) this.onclose(e); });
        this.ws.addEventListener("error", (e) => { this.dispatchEvent(core.CustomEvent("error", e)); if (core.exists(this.onerror)) this.onerror(e); });
        this.ws.addEventListener("message", (e) => { this.dispatchEvent(core.CustomEvent("message", e)); if (core.exists(this.onmessage)) this.onmessage(e); });
        this.ws.addEventListener("open", (e) => { this.dispatchEvent(core.CustomEvent("open", e)); if (core.exists(this.onopen)) this.onopen(e); });
    } as Function as wsClientConstructor;
    construct.prototype.reconnect = function(this: wsClient, ...args: Parameters<Construct>)
    {
        construct.call(this, ...(args.length === 0 ? this.args : args));
    };
    construct.prototype.send = function(this: wsClient, data)
    {
        this.ws.send(data);
    };
    construct.prototype.close = function(this: wsClient, code?: number, reason?: string)
    {
        this.ws.close(code, reason);
    };

    return construct;
} as Function as WebSockets.wsClientGenerator;

export { webSockets };
declare module "cors" {
  import type { RequestHandler } from "express";

  export type CorsRequest = {
    headers?: Record<string, string | string[] | undefined>;
  };

  export type CorsOptions = {
    credentials?: boolean;
    origin?: boolean | string | RegExp | Array<boolean | string | RegExp> | CorsOptionsDelegate<any>;
  };

  export type CorsOptionsDelegate<T = CorsRequest> = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;

  export default function cors(options?: CorsOptions): RequestHandler;
}
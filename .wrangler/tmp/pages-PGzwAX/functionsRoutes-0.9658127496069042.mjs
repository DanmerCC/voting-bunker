import { onRequestOptions as __votar__opcion__js_onRequestOptions } from "C:\\Users\\Usuario\\Desktop\\codigo\\voting-bunker\\functions\\votar\\[opcion].js"
import { onRequestPost as __votar__opcion__js_onRequestPost } from "C:\\Users\\Usuario\\Desktop\\codigo\\voting-bunker\\functions\\votar\\[opcion].js"

export const routes = [
    {
      routePath: "/votar/:opcion",
      mountPath: "/votar",
      method: "OPTIONS",
      middlewares: [],
      modules: [__votar__opcion__js_onRequestOptions],
    },
  {
      routePath: "/votar/:opcion",
      mountPath: "/votar",
      method: "POST",
      middlewares: [],
      modules: [__votar__opcion__js_onRequestPost],
    },
  ]